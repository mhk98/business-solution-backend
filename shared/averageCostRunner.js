const db = require("../models");
const { Op } = require("sequelize");
const { toBaseStockPayload } = require("../helpers/unitConversionHelper");
const { POOLS, businessDate, stockQuantity } = require("./stockReportBalances");
const { replayAverages, findStockRow } = require("./averageCostEngine");
const { averageFields } = require("./averageCost");

// Runs the weighted-average engine against the database: re-costs the open
// month, then writes back movement costs/averages, each stock row's average
// and the cost of goods on Intransit / POS / Sales Return documents.
// Inactive until go-live (scripts/goLiveAverageCost.js writes AVERAGE_SEED rows).
const round4 = (value) => Math.round(Number(value || 0) * 10000) / 10000;
const differs = (a, b) => (a == null) !== (b == null) || Math.abs(Number(a || 0) - Number(b || 0)) > 0.00005;
const monthStart = (day) => `${day.slice(0, 7)}-01`;

// Current unit cost of every purchase-type source document, keyed like the
// engine's docKey (`${sourceType}:${sourceId}`).
const loadDocumentUnitCosts = async (transaction) => {
  const costs = new Map();
  const received = await db.receivedProduct.findAll({
    attributes: ["Id", "purchase_price", "source", "batchId", "deletedAt"],
    paranoid: false, raw: true, transaction,
  });
  for (const row of received) {
    costs.set(`ReceivedProduct:${row.Id}`, Number(row.purchase_price || 0));
    const mixerId = row.source === "Mixer" && String(row.batchId || "").match(/^mixer-(\d+)$/)?.[1];
    if (mixerId && (!row.deletedAt || !costs.has(`Mixer:${mixerId}`))) {
      costs.set(`Mixer:${mixerId}`, Number(row.purchase_price || 0));
    }
  }
  const perBaseUnit = (row) => {
    const quantity = toBaseStockPayload(row.unit, row.unitValue).unitValue;
    return quantity > 0 ? Number(row.cost || 0) / quantity : 0;
  };
  for (const row of await db.manufacture.findAll({
    attributes: ["Id", "unit", "unitValue", "cost"], paranoid: false, raw: true, transaction,
  })) costs.set(`ItemPurchase:${row.Id}`, perBaseUnit(row));
  // Packaging Mixer output: the unit cost it stored (materials + wage), per
  // unit of its own unit → per base unit of the Item Stock it lands in.
  if (db.packagingMixer) {
    for (const row of await db.packagingMixer.findAll({
      attributes: ["Id", "unit", "unitCost"], paranoid: false, raw: true, transaction,
    })) {
      const perUnit = toBaseStockPayload(row.unit || "Pcs", 1).unitValue || 1;
      costs.set(`PackagingMixer:${row.Id}`, Number(row.unitCost || 0) / perUnit);
    }
  }
  if (db.packagingItemPurchase) {
    for (const row of await db.packagingItemPurchase.findAll({
      attributes: ["Id", "unit", "unitValue", "cost"], paranoid: false, raw: true, transaction,
    })) costs.set(`PackagingItemPurchase:${row.Id}`, perBaseUnit(row));
  }
  return costs;
};

const DOCUMENT_COST_MODELS = {
  InTransitProduct: "inTransitProduct",
  PosReport: "posReport",
  ReturnProduct: "returnProduct",
};

const recomputeAverageCosts = async ({ today = businessDate(), apply = true } = {}) =>
  db.sequelize.transaction(async (transaction) => {
    const [lock] = await db.sequelize.query(
      "SELECT GET_LOCK('average_cost_engine', 0) AS got",
      { transaction, type: db.Sequelize.QueryTypes.SELECT },
    );
    if (!Number(lock?.got)) return { skipped: "busy" };
    try {
      const seedId = await db.stockMovement.max("Id", {
        where: { operation: "AVERAGE_SEED" }, transaction,
      });
      if (!seedId) return { skipped: "not live" };

      const stocksByType = {};
      for (const [type, pool] of Object.entries(POOLS)) {
        stocksByType[type] = db[pool.model]
          ? await db[pool.model].findAll({ raw: true, paranoid: false, transaction })
          : [];
      }
      const movements = await db.stockMovement.findAll({ raw: true, transaction });
      const documentUnitCost = await loadDocumentUnitCosts(transaction);
      const fromDate = monthStart(today);
      const { updates, averages, documentCost } = replayAverages({
        movements, stocksByType, fromDate, costedAfterId: seedId, documentUnitCost,
      });

      const summary = { fromDate, movements: 0, stockRows: 0, documents: 0 };
      const byId = new Map(movements.map((row) => [row.Id, row]));
      for (const [id, update] of updates) {
        const row = byId.get(id);
        if (!["unitCost", "unitCostConsumed", "averageCostAfter"].some((f) => differs(row[f], update[f]))) continue;
        summary.movements += 1;
        if (apply) await db.stockMovement.update(update, { where: { Id: id }, transaction });
      }
      for (const [key, { average }] of averages) {
        const type = key.split(":")[0];
        const stock = findStockRow(stocksByType, key);
        if (!stock) continue;
        const quantity = stockQuantity(stock, POOLS[type]);
        // Total-value columns (Item/Factory/Packaging cost, Damage/Repairing
        // purchase_price) are left alone on empty stock — users keep a
        // reference price there; the Stock Product unit price still updates.
        if (quantity <= 0 && type !== "ProductStock") continue;
        // Item/Factory/Packaging keep their average implicitly as cost ÷ qty
        // (qty often in grams); rewrite cost only when the average really moved,
        // not for 4-decimal rounding noise on a large quantity.
        if (POOLS[type].id !== "productId" && Math.abs(Number(stock.cost || 0) / quantity - average) < 0.0001) continue;
        const fields = averageFields(type, { average, quantityAfter: quantity });
        if (!Object.entries(fields).some(([f, v]) => differs(stock[f], v))) continue;
        summary.stockRows += 1;
        if (apply) await db[POOLS[type].model].update(fields, { where: { Id: stock.Id }, transaction });
      }
      for (const [key, cost] of documentCost) {
        const [sourceType, sourceId] = key.split(":");
        const model = db[DOCUMENT_COST_MODELS[sourceType]];
        if (!model || !Number(sourceId)) continue;
        const doc = await model.findByPk(Number(sourceId), { attributes: ["Id", "fifo_cost"], paranoid: false, transaction });
        if (!doc || !differs(doc.fifo_cost, cost)) continue;
        summary.documents += 1;
        if (apply) await model.update({ fifo_cost: round4(cost) }, { where: { Id: doc.Id }, transaction, paranoid: false });
      }
      return summary;
    } finally {
      await db.sequelize.query("SELECT RELEASE_LOCK('average_cost_engine')", { transaction });
    }
  });

// Debounced trigger: every committed stock change schedules one recompute a
// few seconds later, so a bulk entry costs once, not once per line.
let timer = null;
let rerun = false;
const scheduleAverageRecompute = (delayMs = 3000) => {
  if (timer) { rerun = true; return; }
  timer = setTimeout(async () => {
    try {
      const result = await recomputeAverageCosts();
      if (result?.skipped === "busy") rerun = true;
    } catch (error) {
      console.error("[averageCost] recompute failed:", error.message);
    } finally {
      timer = null;
      if (rerun) { rerun = false; scheduleAverageRecompute(delayMs); }
    }
  }, delayMs);
  timer.unref?.();
};

// A price-only edit of a purchase document logs no stock movement, so these
// documents re-cost the open month themselves once their change commits.
let hooksRegistered = false;
const registerAverageCostHooks = () => {
  if (hooksRegistered) return;
  hooksRegistered = true;
  const schedule = (options) => {
    if (options?.transaction?.afterCommit) {
      options.transaction.afterCommit(() => scheduleAverageRecompute());
    } else {
      scheduleAverageRecompute();
    }
  };
  for (const key of ["receivedProduct", "mixer", "manufacture", "packagingItemPurchase", "packagingMixer"]) {
    const model = db[key];
    if (!model) continue;
    model.addHook("afterUpdate", (instance, options) => schedule(options));
    model.addHook("afterBulkUpdate", (options) => schedule(options));
  }
};

// Whether weighted-average costing has gone live (AVERAGE_SEED rows exist).
// Stock screens switch from "last purchase price" to the average only then.
let liveCache = { checkedAt: 0, live: false };
const isAverageCostLive = async () => {
  if (liveCache.live) return true;
  if (Date.now() - liveCache.checkedAt < 60 * 1000) return false;
  const seeds = await db.stockMovement.count({ where: { operation: "AVERAGE_SEED" } });
  liveCache = { checkedAt: Date.now(), live: seeds > 0 };
  return liveCache.live;
};

module.exports = {
  isAverageCostLive,
  recomputeAverageCosts,
  scheduleAverageRecompute,
  registerAverageCostHooks,
  loadDocumentUnitCosts,
};

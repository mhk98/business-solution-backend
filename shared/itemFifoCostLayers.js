// FIFO cost-layer engine for manufacture raw-material items.
//
// Layers live at Item Stock level (`item_masters` rows with productId null),
// keyed by itemId. A purchase opens a layer at its unit cost; Factory
// production (and any other outflow) consumes the oldest layers first. Every
// function runs inside the caller's transaction.
//
// Mirrors shared/packagingFifoCostLayers.js.
const db = require("../models");
const { toBaseStockPayload } = require("../helpers/unitConversionHelper");

const { Op } = db.Sequelize;
const Layer = () => db.itemCostLayer;
const ItemStock = () => db.itemMaster;

const n = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};
const round2 = (value) => Math.round(n(value) * 100) / 100;
const round4 = (value) => Math.round(n(value) * 10000) / 10000;
const today = () => new Date().toISOString().slice(0, 10);

// Weighted-average costing (live on every site since 2026-09-24/26) owns cost:
// once it's live, layers are still drawn down/restored (history, restores)
// but every cost this module reports or writes comes from the stock row's
// average, never from the layers. Required lazily (the runner loads models).
const averageCostLive = () =>
  require("./averageCostRunner").isAverageCostLive();

// Item Stock's own average (cost ÷ base quantity); null when it has no stock.
const stockAverage = async ({ transaction, itemId }) => {
  const stockRow = await ItemStock().findOne({
    where: {
      itemId: Number(itemId),
      [Op.or]: [{ productId: null }, { productId: 0 }],
    },
    order: [["createdAt", "ASC"]],
    transaction,
  });
  if (!stockRow) return null;
  const base = toBaseStockPayload(stockRow.unit, stockRow.unitValue).unitValue;
  return base > 0 ? n(stockRow.cost) / base : null;
};

// Prices a finished consumption at the average once it's live.
const priceAtAverage = async (result, need, averageOf) => {
  if (need <= 0 || !(await averageCostLive())) return result;
  const average = await averageOf();
  if (average == null) return result;
  result.totalCost = round2(need * average);
  result.unitCostConsumed = round4(average);
  result.costBasis = "average";
  return result;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// `quantity` / `unitCost` are per BASE unit.
const openLayer = async ({
  transaction,
  itemId,
  unitCost,
  quantity,
  receivedDate,
  sourceType,
  sourceMovementId = null,
  note = null,
}) => {
  const qty = round2(quantity);
  if (!Number(itemId) || qty <= 0) return null;

  return Layer().create(
    {
      itemId: Number(itemId),
      sourceType: sourceType || "Unknown",
      sourceMovementId: sourceMovementId || null,
      receivedDate: receivedDate || today(),
      originalQty: qty,
      remainingQty: qty,
      unitCost: round4(unitCost),
      note,
    },
    { transaction },
  );
};

// Consume `quantity` (base units) FIFO — oldest receivedDate first.
const consumeFifo = async ({
  transaction,
  itemId,
  quantity,
  fallbackUnitCost = 0,
}) => {
  const need = round2(quantity);
  const result = {
    unitCostConsumed: 0,
    totalCost: 0,
    costBreakdown: [],
    shortfallQty: 0,
  };
  if (!Number(itemId) || need <= 0) return result;

  const layers = await Layer().findAll({
    where: { itemId: Number(itemId), remainingQty: { [Op.gt]: 0 } },
    order: [
      ["receivedDate", "ASC"],
      ["Id", "ASC"],
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let remaining = need;
  let totalCost = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, n(layer.remainingQty));
    if (take <= 0) continue;
    const unitCost = n(layer.unitCost);
    totalCost += take * unitCost;
    result.costBreakdown.push({
      layerId: layer.Id,
      qty: round2(take),
      unitCost: round4(unitCost),
    });
    await layer.update(
      { remainingQty: round2(n(layer.remainingQty) - take) },
      { transaction },
    );
    remaining = round2(remaining - take);
  }

  if (remaining > 0) {
    const unitCost = round4(fallbackUnitCost);
    totalCost += remaining * unitCost;
    result.shortfallQty = remaining;
    result.costBreakdown.push({
      layerId: null,
      qty: remaining,
      unitCost,
      estimated: true,
    });
  }

  result.totalCost = round2(totalCost);
  result.unitCostConsumed = need > 0 ? round4(totalCost / need) : 0;
  return priceAtAverage(result, need, () =>
    stockAverage({ transaction, itemId }),
  );
};

const restoreToLayers = async ({ transaction, costBreakdown }) => {
  const entries = asArray(costBreakdown);
  let restoredQty = 0;
  for (const entry of entries) {
    if (!entry || !entry.layerId) continue;
    const layer = await Layer().findByPk(entry.layerId, {
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!layer) continue;
    const next = Math.min(
      n(layer.originalQty),
      round2(n(layer.remainingQty) + n(entry.qty)),
    );
    restoredQty += next - n(layer.remainingQty);
    await layer.update({ remainingQty: next }, { transaction });
  }
  return { restoredQty: round2(restoredQty) };
};

// Remove `quantity` newest-first (a purchase reversed/deleted).
const unwindInbound = async ({ transaction, itemId, quantity }) => {
  const need = round2(quantity);
  if (!Number(itemId) || need <= 0) return { removedQty: 0 };

  const layers = await Layer().findAll({
    where: { itemId: Number(itemId), remainingQty: { [Op.gt]: 0 } },
    order: [
      ["receivedDate", "DESC"],
      ["Id", "DESC"],
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let remaining = need;
  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, n(layer.remainingQty));
    await layer.update(
      { remainingQty: round2(n(layer.remainingQty) - take) },
      { transaction },
    );
    remaining = round2(remaining - take);
  }
  return { removedQty: round2(need - remaining) };
};

// The layer a purchase opened (latest one, if it was edited before this fix).
const findSourceLayer = ({ transaction, itemId, sourceType, sourceId }) =>
  Layer().findOne({
    where: {
      itemId: Number(itemId),
      sourceType,
      sourceMovementId: Number(sourceId),
    },
    order: [["Id", "DESC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

// Reverse a purchase: take `quantity` out of the purchase's own layer first;
// only what that layer no longer holds (already consumed) comes out of the
// newest other layers. Unlike a bare unwindInbound, a later purchase's layer
// (and its price) is never drained while this one still has stock.
const removeInbound = async ({
  transaction,
  itemId,
  quantity,
  sourceType,
  sourceId,
}) => {
  let remaining = round2(quantity);
  if (!Number(itemId) || remaining <= 0) return;

  const layer = sourceId
    ? await findSourceLayer({ transaction, itemId, sourceType, sourceId })
    : null;
  if (layer) {
    const take = Math.min(remaining, n(layer.remainingQty));
    await layer.update(
      { remainingQty: round2(n(layer.remainingQty) - take) },
      { transaction },
    );
    remaining = round2(remaining - take);
  }
  if (remaining > 0) {
    await unwindInbound({ transaction, itemId, quantity: remaining });
  }
};

// Edit a purchase on the same item in place: its own layer takes the new
// quantity and unit cost. What was already consumed from it stays consumed
// (at the cost it was consumed at); if the new quantity is below that, the
// difference comes out of the newest other layers. Purchases without a layer
// of their own (pre-FIFO data) fall back to unwind + a fresh layer.
const reviseInbound = async ({
  transaction,
  itemId,
  sourceType,
  sourceId,
  oldQuantity,
  quantity,
  unitCost,
  receivedDate,
}) => {
  const layer = await findSourceLayer({
    transaction,
    itemId,
    sourceType,
    sourceId,
  });
  if (!layer) {
    await unwindInbound({ transaction, itemId, quantity: oldQuantity });
    return openLayer({
      transaction,
      itemId,
      unitCost,
      quantity,
      receivedDate,
      sourceType,
      sourceMovementId: sourceId,
    });
  }

  const nextQty = round2(quantity);
  const used = Math.max(
    0,
    round2(n(layer.originalQty) - n(layer.remainingQty)),
  );
  const nextRemaining = round2(nextQty - used);
  await layer.update(
    {
      originalQty: Math.max(nextQty, used),
      remainingQty: Math.max(0, nextRemaining),
      unitCost: round4(unitCost),
      receivedDate: receivedDate || layer.receivedDate,
    },
    { transaction },
  );
  if (nextRemaining < 0) {
    await unwindInbound({ transaction, itemId, quantity: -nextRemaining });
  }
  return layer;
};

// Σ(remainingQty × unitCost) across an item's open layers.
const layerValue = async ({ transaction, itemId }) => {
  const row = await Layer().findOne({
    attributes: [
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal("remainingQty * unitCost"),
        ),
        "value",
      ],
      [db.Sequelize.fn("SUM", db.Sequelize.col("remainingQty")), "qty"],
    ],
    where: { itemId: Number(itemId) },
    transaction,
    raw: true,
  });
  return { value: round2(row && row.value), qty: round2(row && row.qty) };
};

const currentUnitCost = async ({ transaction, itemId, fallback = 0 }) => {
  if (await averageCostLive()) {
    const average = await stockAverage({ transaction, itemId });
    return round4(average ?? fallback);
  }
  const { value, qty } = await layerValue({ transaction, itemId });
  return qty > 0 ? round4(value / qty) : round4(fallback);
};

// Last known unit cost per item, from layers regardless of remainingQty
// (layers are never deleted, only drawn down) — unlike currentUnitCost, this
// still resolves a price after an item's stock is fully depleted, for
// display/reporting purposes where a stale-but-real reference price beats 0.
const lastKnownUnitCostMap = async (itemIds) => {
  const ids = [
    ...new Set(
      (itemIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (!ids.length) return new Map();

  const layers = await Layer().findAll({
    where: { itemId: { [Op.in]: ids } },
    order: [
      ["receivedDate", "DESC"],
      ["Id", "DESC"],
    ],
    raw: true,
  });

  const map = new Map();
  for (const layer of layers) {
    if (!map.has(layer.itemId)) {
      map.set(layer.itemId, n(layer.unitCost));
    }
  }
  return map;
};

// Keep the flat (productId null) Item Stock row's `cost` in step with layers.
const syncItemStockCost = async ({ transaction, itemId }) => {
  // The average cost engine owns Item Stock's cost once it's live.
  if (await averageCostLive()) return;
  const stockRow = await ItemStock().findOne({
    where: {
      itemId: Number(itemId),
      [Op.or]: [{ productId: null }, { productId: 0 }],
    },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    order: [["createdAt", "ASC"]],
  });
  if (!stockRow) return;

  const { value } = await layerValue({ transaction, itemId });
  const base = toBaseStockPayload(stockRow.unit, stockRow.unitValue).unitValue;
  const nextCost = base > 0 ? Math.max(0, value) : 0;
  if (round2(stockRow.cost) !== round2(nextCost)) {
    await stockRow.update({ cost: round2(nextCost) }, { transaction });
  }
};

module.exports = {
  openLayer,
  consumeFifo,
  restoreToLayers,
  unwindInbound,
  removeInbound,
  reviseInbound,
  layerValue,
  currentUnitCost,
  lastKnownUnitCostMap,
  syncItemStockCost,
};

// Weighted-average cost engine: replays the StockMovement ledger in date order
// and derives, for every movement from `fromDate` on, what it cost and the
// pool's average after it. One place for the whole costing policy (see
// memory/weighted-average-costing) instead of per-flow arithmetic:
//
//   IN  purchase / mixer output     → blends at the movement's own unitCost
//   IN  transfer (Product→Damage, Damage→Repairing, Repairing→Product,
//       Item→Factory, PackagingItem→PackagingFactory) → source pool's cost
//   IN  sales return                → last sale cost of that product
//   IN  reversal of an outbound     → the reversed movement's cost
//   IN  anything else (adjustment, courier, reconcile) → current average
//   OUT                             → current average (average unchanged)
//   OUT reversal of an inbound      → un-blends at that inbound's cost
//
// Only the current month is re-costed; closed months keep their stored
// figures. A backdated entry that lands in a closed month is costed as if it
// happened at the start of the current month.
const {
  POOLS, normalizeStockType, createPoolKeyResolver, liveBalances, effectiveLedgerRows,
} = require("./stockReportBalances");
const { currentAverage } = require("./averageCost");

const round4 = (value) => Math.round(Number(value || 0) * 10000) / 10000;
const dateKey = (value) => String(value || "").slice(0, 10);
const REVERSAL_OPERATIONS = new Set(["DELETE", "UPDATE_REVERSE", "REVERSE"]);
const COSTED_ON_OUT = new Set(["InTransitProduct", "PosReport"]);
// Transfer IN sourceType → the pool its units leave.
const TRANSFER_SOURCE_POOL = {
  "DamageProduct:DamageStock": "ProductStock",
  "DamageRepair:RepairingStock": "DamageStock",
  "DamageRepaired:ProductStock": "RepairingStock",
  "Factory:FactoryStock": "ItemStock",
  "PackagingFactory:PackagingFactoryStock": "PackagingItemStock",
};

const docKey = (row) => `${row.sourceType}:${row.sourceId}`;

// `documentUnitCost`: Map docKey → current unit cost of purchase-type source
// documents (Purchase Product, Mixer output, Item/Packaging purchase). Read
// from the document at replay time, so a price-only edit of a purchase (which
// logs no quantity movement) still re-costs the open month.
// `costedAfterId`: only movements with a higher Id (logged after the go-live
// AVERAGE_SEED rows) are ever costed; everything before go-live is valued at
// the seeded average.
const replayAverages = ({ movements, stocksByType, fromDate, costedAfterId = 0, documentUnitCost = new Map() }) => {
  const keyFor = createPoolKeyResolver(stocksByType);
  const live = liveBalances(stocksByType);
  const rows = effectiveLedgerRows(movements)
    .filter((row) => row.operation !== "OPENING_BALANCE" && POOLS[normalizeStockType(row.stockType)])
    .map((row) => ({ ...row, type: normalizeStockType(row.stockType), key: keyFor(row), day: dateKey(row.date) }));

  // Movements to (re)cost: logged after go-live and dated in the open period,
  // plus not-yet-costed ones dated in a closed month (costed at fromDate).
  const eligible = (row) => row.Id > costedAfterId && row.operation !== "AVERAGE_SEED";
  const isLate = (row) => eligible(row) && row.day < fromDate && row.averageCostAfter == null;
  const replay = rows.filter((row) => eligible(row) && (row.day >= fromDate || isLate(row)));
  const inReplay = new Set(replay.map((row) => row.Id));

  // Starting quantity per pool = live − everything replayed; starting average =
  // the last stored average before fromDate, else the row's current price.
  const state = new Map();
  const ensure = (key, type) => {
    if (!state.has(key)) {
      const liveRow = live.get(key);
      const stock = findStockRow(stocksByType, key);
      state.set(key, { qty: liveRow ? liveRow.quantity : 0, avg: stock ? currentAverage(type, stock) : 0 });
    }
    return state.get(key);
  };
  for (const row of replay) ensure(row.key, row.type).qty -= Number(row.quantityChange || 0);
  const lastStored = new Map();
  for (const row of rows) {
    if (inReplay.has(row.Id) || row.averageCostAfter == null) continue;
    const prev = lastStored.get(row.key);
    if (!prev || row.day > prev.day || (row.day === prev.day && row.Id > prev.Id)) lastStored.set(row.key, row);
  }
  for (const [key, row] of lastStored) ensure(key, row.type).avg = Number(row.averageCostAfter);

  // Replay order: late entries first (at fromDate), then by date; within one
  // document, outbound legs before inbound legs so transfers can read the cost.
  replay.sort((a, b) => {
    const da = isLate(a) ? "" : a.day;
    const db = isLate(b) ? "" : b.day;
    if (da !== db) return da < db ? -1 : 1;
    if (docKey(a) === docKey(b)) {
      // original outbound legs → original inbound legs → reversals of them
      const rank = (row) => (REVERSAL_OPERATIONS.has(row.operation) ? 2 : Number(row.quantityChange) < 0 ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
    }
    return String(a.createdAt).localeCompare(String(b.createdAt)) || a.Id - b.Id;
  });

  const bySource = new Map();
  for (const row of rows) {
    if (!bySource.has(docKey(row))) bySource.set(docKey(row), []);
    bySource.get(docKey(row)).push(row);
  }
  const updates = new Map(); // Id → { unitCost, unitCostConsumed, averageCostAfter }
  const costOf = (row, field) => {
    const updated = updates.get(row.Id);
    if (updated && updated[field] != null) return updated[field];
    if (field === "unitCost" && documentUnitCost.has(docKey(row))) return documentUnitCost.get(docKey(row));
    return row[field] == null ? null : Number(row[field]);
  };
  const original = (row, positive) => (bySource.get(docKey(row)) || []).find((other) =>
    other.Id !== row.Id && other.key === row.key && !REVERSAL_OPERATIONS.has(other.operation) &&
    (positive ? Number(other.quantityChange) > 0 : Number(other.quantityChange) < 0));
  const lastSaleCost = new Map();
  // Latest outbound cost per document and pool — a transfer's inbound leg
  // takes the most recent outbound leg of the same document (after an edit
  // that is the edited quantity's cost, not the original entry's).
  const lastTransferOut = new Map();
  const documentCost = new Map(); // docKey → cost of goods for that document

  for (const row of replay) {
    const pool = ensure(row.key, row.type);
    const change = Number(row.quantityChange || 0);
    const update = { averageCostAfter: null, unitCost: null, unitCostConsumed: null };
    if (row.operation === "REVALUATION" && row.averageCostAfter != null) {
      // Admin price edit: the entered price becomes the average from here on.
      pool.avg = Number(row.averageCostAfter);
    } else if (change > 0) {
      let cost = pool.avg;
      const transferFrom = TRANSFER_SOURCE_POOL[`${row.sourceType}:${row.type}`];
      if (REVERSAL_OPERATIONS.has(row.operation)) {
        const out = original(row, false);
        cost = out ? costOf(out, "unitCostConsumed") ?? pool.avg : pool.avg;
      } else if (transferFrom) {
        const out = (bySource.get(docKey(row)) || []).find((other) => other.type === transferFrom && Number(other.quantityChange) < 0);
        cost = lastTransferOut.get(`${docKey(row)}|${transferFrom}`)
          ?? (out ? costOf(out, "unitCostConsumed") : null)
          ?? pool.avg;
      } else if (row.sourceType === "ReturnProduct") {
        cost = lastSaleCost.get(row.key) ?? pool.avg;
      } else if (documentUnitCost.has(docKey(row))) {
        cost = documentUnitCost.get(docKey(row));
      } else if (row.unitCost != null && Number(row.unitCost) > 0) {
        cost = Number(row.unitCost);
      }
      const qtyBefore = Math.max(pool.qty, 0);
      pool.avg = qtyBefore > 0 ? (qtyBefore * pool.avg + change * cost) / (qtyBefore + change) : cost;
      update.unitCost = round4(cost);
      if (COSTED_ON_OUT.has(row.sourceType) && REVERSAL_OPERATIONS.has(row.operation)) {
        documentCost.set(docKey(row), (documentCost.get(docKey(row)) || 0) - change * cost);
      }
      if (row.sourceType === "ReturnProduct") {
        documentCost.set(docKey(row), (documentCost.get(docKey(row)) || 0) + change * cost);
      }
    } else if (change < 0) {
      const quantity = -change;
      const inbound = REVERSAL_OPERATIONS.has(row.operation) ? original(row, true) : null;
      if (inbound) {
        const cost = costOf(inbound, "unitCost") ?? pool.avg;
        const qtyAfter = pool.qty - quantity;
        if (qtyAfter > 0) pool.avg = (pool.qty * pool.avg - quantity * cost) / qtyAfter;
        update.unitCostConsumed = round4(cost);
      } else {
        update.unitCostConsumed = round4(pool.avg);
        lastTransferOut.set(`${docKey(row)}|${row.type}`, update.unitCostConsumed);
        if (COSTED_ON_OUT.has(row.sourceType)) {
          lastSaleCost.set(row.key, update.unitCostConsumed);
          documentCost.set(docKey(row), (documentCost.get(docKey(row)) || 0) + quantity * update.unitCostConsumed);
        }
      }
    }
    pool.avg = Math.max(round4(pool.avg), 0);
    pool.qty += change;
    update.averageCostAfter = pool.avg;
    updates.set(row.Id, update);
  }

  const averages = new Map();
  for (const [key, pool] of state) averages.set(key, { average: pool.avg, quantity: pool.qty });
  for (const [key, cost] of documentCost) documentCost.set(key, Math.round(cost * 100) / 100);
  return { updates, averages, documentCost };
};

const findStockRow = (stocksByType, key) => {
  const [type, kind, id] = key.split(":");
  const rows = (stocksByType[type] || []).filter((row) => !row.deletedAt);
  return kind === "row"
    ? rows.find((row) => Number(row.Id) === Number(id))
    : rows.find((row) => Number(row.productId) === Number(id));
};

module.exports = { replayAverages, findStockRow, TRANSFER_SOURCE_POOL };

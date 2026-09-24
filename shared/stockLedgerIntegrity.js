const db = require("../models");
const { logStockMovement } = require("./stockMovementLogger");
const {
  POOLS, liveBalances, createPoolKeyResolver, effectiveLedgerRows, normalizeStockType,
} = require("./stockReportBalances");

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

// Pure check: for every live stock row (all 7 pools), the effective movement
// ledger must add up to its current quantity — dated stock balances are
// walked back from live stock over this ledger, so any stock change that was
// never logged shows up here as a mismatch.
const findLedgerMismatches = ({ stocksByType, movements }) => {
  const keyFor = createPoolKeyResolver(stocksByType);
  const live = liveBalances(stocksByType);
  const ledger = new Map();
  const sample = new Map(); // key → a movement row, to log a fix on the same pool
  for (const row of effectiveLedgerRows(movements)) {
    if (row.operation === "OPENING_BALANCE" || !POOLS[normalizeStockType(row.stockType)]) continue;
    const key = keyFor(row);
    ledger.set(key, round2((ledger.get(key) || 0) + Number(row.quantityChange || 0)));
    if (!sample.has(key)) sample.set(key, row);
  }
  const mismatches = [];
  for (const [key, anchor] of live) {
    const ledgerQty = round2(ledger.get(key));
    if (Math.abs(anchor.quantity - ledgerQty) < 0.01) continue;
    mismatches.push({ key, type: anchor.type, name: anchor.name, ledger: ledgerQty, live: anchor.quantity });
  }
  // A stock row deleted outright (or soft-deleted) keeps its movements; if they
  // don't net to zero the reports would show "ghost" stock. Its live qty is 0.
  for (const [key, ledgerQty] of ledger) {
    if (live.has(key) || Math.abs(ledgerQty) < 0.01) continue;
    const row = sample.get(key);
    mismatches.push({
      key, type: normalizeStockType(row.stockType), name: row.name, ledger: ledgerQty, live: 0,
      orphan: {
        Id: row.stockRowId, productId: row.productId, itemId: row.itemId,
        manufacturerId: row.manufacturerId, variantKey: row.variantKey, name: row.name, unit: row.unit,
      },
    });
  }
  return mismatches;
};

const stockRowFor = (stocksByType, mismatch) => {
  const [type, kind, id] = mismatch.key.split(":");
  const rows = (stocksByType[type] || []).filter((row) => !row.deletedAt);
  return kind === "row"
    ? rows.find((row) => Number(row.Id) === Number(id))
    : rows.find((row) => Number(row.productId) === Number(id));
};

// Reads live stock and the ledger in ONE transaction (a consistent snapshot),
// under a DB-wide lock so two app servers on the same database never fix the
// same gap twice. With autoFix, each gap gets a RECONCILE row dated today.
const checkStockLedgerIntegrity = async ({ autoFix = true } = {}) =>
  db.sequelize.transaction(async (transaction) => {
    const [lock] = await db.sequelize.query(
      "SELECT GET_LOCK('stock_ledger_integrity', 0) AS got",
      { transaction, type: db.Sequelize.QueryTypes.SELECT },
    );
    if (!Number(lock?.got)) return { skipped: true, mismatches: [] };
    try {
      const stocksByType = {};
      for (const [type, pool] of Object.entries(POOLS)) {
        stocksByType[type] = db[pool.model]
          ? await db[pool.model].findAll({ raw: true, paranoid: false, transaction })
          : [];
      }
      const movements = await db.stockMovement.findAll({ raw: true, transaction });
      const mismatches = findLedgerMismatches({ stocksByType, movements });
      if (autoFix) {
        for (const mismatch of mismatches) {
          const stockRow = stockRowFor(stocksByType, mismatch) || mismatch.orphan;
          await logStockMovement({
            transaction,
            sourceType: "StockLedgerIntegrityCheck",
            operation: "RECONCILE",
            stockType: mismatch.type,
            stockRow,
            itemId: POOLS[mismatch.type].id === "packagingItemId" ? stockRow?.packagingItemId : undefined,
            unit: POOLS[mismatch.type].id === "productId" ? "Pcs" : stockRow?.unit,
            quantityChange: round2(mismatch.live - mismatch.ledger),
            balanceBefore: mismatch.ledger,
            balanceAfter: mismatch.live,
            metadata: JSON.stringify({ reason: "untracked stock change found by integrity check" }),
          });
        }
      }
      return { skipped: false, mismatches, fixed: autoFix };
    } finally {
      await db.sequelize.query("SELECT RELEASE_LOCK('stock_ledger_integrity')", { transaction });
    }
  });

module.exports = { findLedgerMismatches, checkStockLedgerIntegrity };

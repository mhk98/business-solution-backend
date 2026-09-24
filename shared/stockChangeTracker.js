const db = require("../models");
const { Op } = require("sequelize");
const { logStockMovement } = require("./stockMovementLogger");
const { POOLS, stockQuantity } = require("./stockReportBalances");

// Safety net for multi-step stock edits (edit/delete/return paths that move
// quantity between several stock rows in one transaction). Call touch() on a
// stock row BEFORE changing it and created() after creating one; flush() at the
// end logs, per row, whatever part of its real quantity change was NOT already
// logged by a helper inside the same flow — so it never double-logs and never
// leaves a gap in the StockMovement ledger the dated stock reports rely on.
const plain = (row) => (row?.toJSON ? row.toJSON() : row);
const quantityOf = (stockType, row) =>
  row && !row.deletedAt ? stockQuantity(plain(row), POOLS[stockType]) : 0;

// Movement rows that belong to this stock row's pool.
const poolWhere = (stockType, row) => {
  if (POOLS[stockType].id === "productId") return { stockType, productId: row.productId };
  const types = stockType === "ItemStock" ? ["ItemStock", "PackagingStock"] : [stockType];
  return { stockType: { [Op.in]: types }, stockRowId: row.Id };
};

const createStockTracker = ({ transaction, sourceType, sourceId = null, operation, date = null }) => {
  const tracked = new Map();

  const track = async (stockType, row, before) => {
    if (!row || !POOLS[stockType]) return;
    const key = `${stockType}:${row.Id}`;
    if (tracked.has(key)) return;
    // Baseline read after the caller's locked read: movements committed by
    // other transactions are already in `before`, later ones are this flow's.
    const baselineId = (await db.stockMovement.max("Id", { transaction })) || 0;
    tracked.set(key, { stockType, Model: row.constructor, id: row.Id, before, baselineId });
  };

  return {
    touch: (stockType, row) => track(stockType, row, quantityOf(stockType, row)),
    created: (stockType, row) => track(stockType, row, 0),
    flush: async () => {
      for (const entry of tracked.values()) {
        const after = await entry.Model.findByPk(entry.id, { transaction, paranoid: false });
        if (!after) continue;
        const afterQty = quantityOf(entry.stockType, after);
        const alreadyLogged = Number(
          (await db.stockMovement.sum("quantityChange", {
            where: { Id: { [Op.gt]: entry.baselineId }, ...poolWhere(entry.stockType, plain(after)) },
            transaction,
          })) || 0,
        );
        const remainder = Math.round((afterQty - entry.before - alreadyLogged) * 100) / 100;
        if (!remainder) continue;
        const row = plain(after);
        await logStockMovement({
          transaction,
          sourceType,
          sourceId,
          operation,
          stockType: entry.stockType,
          stockRow: row,
          unit: POOLS[entry.stockType].id === "productId" ? "Pcs" : row.unit,
          date: date ? String(date).slice(0, 10) : null,
          quantityChange: remainder,
          balanceBefore: afterQty - remainder,
          balanceAfter: afterQty,
        });
      }
    },
  };
};

module.exports = { createStockTracker };

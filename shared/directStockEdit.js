const db = require("../models");
const { logStockMovement } = require("./stockMovementLogger");
const { POOLS, stockQuantity } = require("./stockReportBalances");

// Plain create/update/delete endpoints on a stock table (Stock Product, Item
// Stock, Damage Stock, Damage Repairing Stock) bypass every business flow, so
// a quantity changed through them would never reach StockMovement and the
// dated stock balances (see stockReportBalances.collectStockBalances) would
// silently drift. These wrappers log the net quantity change of each touched
// row, inside the same transaction as the write.
const plain = (row) => (row?.toJSON ? row.toJSON() : row);
const quantityOf = (stockType, row) =>
  row && !row.deletedAt ? stockQuantity(plain(row), POOLS[stockType]) : 0;

const logChange = async ({ stockType, operation, before, after, transaction }) => {
  const balanceBefore = quantityOf(stockType, before);
  const balanceAfter = quantityOf(stockType, after);
  const row = plain(after || before);
  if (!row || balanceAfter === balanceBefore) return;
  await logStockMovement({
    transaction,
    sourceType: "DirectStockEdit",
    sourceId: row.Id,
    operation,
    stockType,
    stockRow: row,
    unit: POOLS[stockType].id === "productId" ? "Pcs" : row.unit,
    quantityChange: balanceAfter - balanceBefore,
    balanceBefore,
    balanceAfter,
  });
};

const createWithStockLog = (Model, stockType, data) =>
  db.sequelize.transaction(async (transaction) => {
    const row = await Model.create(data, { transaction });
    await logChange({ stockType, operation: "CREATE", before: null, after: row, transaction });
    return row;
  });

const updateWithStockLog = (Model, stockType, where, payload) =>
  db.sequelize.transaction(async (transaction) => {
    const beforeRows = await Model.findAll({ where, transaction, lock: transaction.LOCK.UPDATE });
    const result = await Model.update(payload, { where, transaction });
    for (const before of beforeRows) {
      const after = await Model.findByPk(before.Id, { transaction });
      await logChange({ stockType, operation: "UPDATE", before, after, transaction });
    }
    return result;
  });

const destroyWithStockLog = (Model, stockType, where) =>
  db.sequelize.transaction(async (transaction) => {
    const beforeRows = await Model.findAll({ where, transaction, lock: transaction.LOCK.UPDATE });
    const result = await Model.destroy({ where, transaction });
    for (const before of beforeRows) {
      await logChange({ stockType, operation: "DELETE", before, after: null, transaction });
    }
    return result;
  });

module.exports = { createWithStockLog, updateWithStockLog, destroyWithStockLog };

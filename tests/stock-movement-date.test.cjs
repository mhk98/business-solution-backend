const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const created = [];
const modelsPath = path.resolve(__dirname, '../models/index.js');
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: {
  stockMovement: { create: async (row) => { created.push(row); return row; } },
  stockAdjustment: { findByPk: async (id) => (id === 7 ? { date: '2026-09-10' } : null) },
} };
const { logStockMovement } = require('../shared/stockMovementLogger');
const { businessDate } = require('../shared/stockReportBalances');

const base = { transaction: {}, sourceType: 'StockAdjustment', operation: 'DELETE', stockType: 'ItemStock', quantityChange: -5, balanceBefore: 10, balanceAfter: 5 };

test('a movement without a date takes its source document date, not today', async () => {
  created.length = 0;
  await logStockMovement({ ...base, sourceId: 7 });
  assert.equal(created[0].date, '2026-09-10');
});

test('an explicit date wins, and an unknown document falls back to today', async () => {
  created.length = 0;
  await logStockMovement({ ...base, sourceId: 7, date: '2026-09-15' });
  await logStockMovement({ ...base, sourceId: 99 });
  assert.equal(created[0].date, '2026-09-15');
  assert.equal(created[1].date, businessDate());
});

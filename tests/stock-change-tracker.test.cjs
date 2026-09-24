const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// In-memory StockMovement table so the tracker runs without a database.
const movements = [];
const modelsPath = path.resolve(__dirname, '../models/index.js');
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: {
  stockMovement: {
    create: async (row) => { const r = { Id: movements.length + 1, ...row }; movements.push(r); return r; },
    max: async () => movements.length,
    sum: async (field, { where }) => movements
      .filter((m) => m.Id > where.Id[Object.getOwnPropertySymbols(where.Id)[0]])
      .filter((m) => (where.productId ? m.productId === where.productId && m.stockType === where.stockType : m.stockRowId === where.stockRowId))
      .reduce((s, m) => s + m[field], 0),
  },
} };
const { createStockTracker } = require('../shared/stockChangeTracker');
const { logStockMovement } = require('../shared/stockMovementLogger');

class FakeRow { constructor(data) { Object.assign(this, data); } }
const table = new Map();
FakeRow.findByPk = async (id) => table.get(id);
const row = (data) => { const r = new FakeRow(data); table.set(r.Id, r); return r; };

test('tracker logs the unlogged part of each row change, never double-logging', async () => {
  movements.length = 0;
  const product = row({ Id: 1, productId: 5, name: 'Fan', quantity: 50 });
  const damage = row({ Id: 2, productId: 5, name: 'Fan', quantity: 10 });
  const tracker = createStockTracker({ transaction: {}, sourceType: 'DamageProduct', sourceId: 7, operation: 'UPDATE', date: '2026-09-20' });
  await tracker.touch('ProductStock', product);
  await tracker.touch('DamageStock', damage);
  product.quantity = 46;               // unlogged change: −4
  damage.quantity = 14;                // +4, of which a helper already logged +1
  await logStockMovement({ transaction: {}, sourceType: 'Helper', operation: 'CREATE', stockType: 'DamageStock', productId: 5, quantityChange: 1, balanceBefore: 10, balanceAfter: 11 });
  await tracker.flush();
  const byTracker = movements.filter((m) => m.sourceType === 'DamageProduct');
  assert.deepEqual(byTracker.map((m) => [m.stockType, m.quantityChange, m.balanceBefore, m.balanceAfter, m.date]),
    [['ProductStock', -4, 50, 46, '2026-09-20'], ['DamageStock', 3, 11, 14, '2026-09-20']]);
});

test('tracker logs nothing when quantities are unchanged or fully logged', async () => {
  movements.length = 0;
  const product = row({ Id: 3, productId: 6, quantity: 20 });
  const tracker = createStockTracker({ transaction: {}, sourceType: 'X', operation: 'UPDATE' });
  await tracker.touch('ProductStock', product);
  await tracker.flush();
  assert.equal(movements.length, 0);
});

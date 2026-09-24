const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

// Mock ../models so the wrappers run without a database.
const logged = [];
const modelsPath = path.resolve(__dirname, '../models/index.js');
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: {
  sequelize: { transaction: async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }) },
  stockMovement: { create: async (row) => { logged.push(row); return row; } },
} };
const { createWithStockLog, updateWithStockLog, destroyWithStockLog } = require('../shared/directStockEdit');

const fakeModel = (rows) => ({
  create: async (data) => { const row = { Id: rows.length + 1, ...data }; rows.push(row); return row; },
  findAll: async ({ where }) => rows.filter((r) => r.Id === where.Id && !r.deletedAt).map((r) => ({ ...r })),
  findByPk: async (id) => ({ ...rows.find((r) => r.Id === id) }),
  update: async (payload, { where }) => { const r = rows.find((x) => x.Id === where.Id); Object.assign(r, payload); return [1]; },
  destroy: async ({ where }) => { rows.find((x) => x.Id === where.Id).deletedAt = new Date(); return 1; },
});

test('direct Stock Product create/update/delete log the net quantity change', async () => {
  logged.length = 0;
  const Model = fakeModel([]);
  await createWithStockLog(Model, 'ProductStock', { productId: 9, name: 'Fan', quantity: 10 });
  assert.deepEqual(await updateWithStockLog(Model, 'ProductStock', { Id: 1 }, { quantity: 7 }), [1]);
  await updateWithStockLog(Model, 'ProductStock', { Id: 1 }, { purchase_price: 50 }); // no qty change
  await destroyWithStockLog(Model, 'ProductStock', { Id: 1 });
  assert.deepEqual(logged.map((r) => [r.operation, r.quantityChange, r.balanceBefore, r.balanceAfter]),
    [['CREATE', 10, 0, 10], ['UPDATE', -3, 10, 7], ['DELETE', -7, 7, 0]]);
  assert.ok(logged.every((r) => r.sourceType === 'DirectStockEdit' && r.stockType === 'ProductStock' && r.productId === 9));
});

test('direct Item Stock edit logs unitValue in the row unit', async () => {
  logged.length = 0;
  const Model = fakeModel([{ Id: 1, itemId: 4, unit: 'Gram', unitValue: 500 }]);
  await updateWithStockLog(Model, 'ItemStock', { Id: 1 }, { unitValue: 800 });
  assert.equal(logged.length, 1);
  assert.equal(logged[0].quantityChange, 300);
  assert.equal(logged[0].unit, 'Gram');
  assert.equal(logged[0].stockRowId, 1);
});

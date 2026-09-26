const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Mock ../models with counts we control.
const state = { movements: 0, stock: 0, created: [] };
const count = (n) => async () => n();
const modelsPath = path.resolve(__dirname, '../models/index.js');
const stockModel = { count: count(() => state.stock) };
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: {
  Sequelize: { QueryTypes: { SELECT: 'SELECT' } },
  sequelize: {
    transaction: async (fn) => fn({}),
    query: async () => [{ got: 1 }],
  },
  stockMovement: {
    count: count(() => state.movements),
    create: async (row) => { state.created.push(row); return row; },
  },
  inventoryMaster: stockModel, damageStock: stockModel, damageReparingStock: stockModel,
  itemMaster: stockModel, manufactureStock: stockModel, packagingItemStock: stockModel, packagingFactoryStock: stockModel,
} };
const { autoGoLiveEmptyDatabase } = require('../shared/averageCostRunner');

test('an empty database goes live with a single marker row', async () => {
  Object.assign(state, { movements: 0, stock: 0, created: [] });
  assert.equal(await autoGoLiveEmptyDatabase(), true);
  assert.equal(state.created.length, 1);
  assert.equal(state.created[0].operation, 'AVERAGE_SEED');
  assert.equal(state.created[0].stockType, 'AverageCostGoLive');
});

test('a database with movements or stock is left for the go-live script', async () => {
  Object.assign(state, { movements: 5, stock: 0, created: [] });
  assert.equal(await autoGoLiveEmptyDatabase(), false);
  Object.assign(state, { movements: 0, stock: 3, created: [] });
  assert.equal(await autoGoLiveEmptyDatabase(), false);
  assert.equal(state.created.length, 0);
});

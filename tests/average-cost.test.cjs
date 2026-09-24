const test = require('node:test');
const assert = require('node:assert/strict');
const { currentAverage, blendAverage, inbound, outbound, revalue } = require('../shared/averageCost');

test('5 units at ৳10 + 5 units at ৳20 blend to ৳15, and selling keeps the average', () => {
  let product = { productId: 1, quantity: 5, purchase_price: 10, averageCost: 10 };
  const buy = inbound('ProductStock', product, { quantity: 5, unitCost: 20 });
  assert.equal(buy.average, 15);
  assert.deepEqual(buy.fields, { averageCost: 15, purchase_price: 15 });
  product = { ...product, quantity: 10, ...buy.fields };
  const sale = outbound('ProductStock', product, { quantity: 4 });
  assert.equal(sale.totalCost, 60);
  assert.equal(sale.fields.averageCost, 15);
  assert.deepEqual(sale.movement, { unitCostConsumed: 15, averageCostAfter: 15 });
});

test('empty stock takes the incoming cost; fractional averages are kept exactly', () => {
  assert.equal(blendAverage({ quantityBefore: 0, averageBefore: 99, inQuantity: 3, inCost: 12 }), 12);
  assert.equal(blendAverage({ quantityBefore: -2, averageBefore: 99, inQuantity: 3, inCost: 12 }), 12);
  const r = inbound('ProductStock', { quantity: 2, averageCost: 10 }, { quantity: 1, unitCost: 11 });
  assert.equal(r.average, 10.3333);
  assert.equal(r.fields.purchase_price, 10);
});

test('damage stock keeps a total value; item stock keeps cost = qty × average', () => {
  const damage = inbound('DamageStock', { productId: 1, quantity: 2, purchase_price: 100 }, { quantity: 2, unitCost: 70 });
  assert.equal(damage.average, 60);
  assert.deepEqual(damage.fields, { averageCost: 60, purchase_price: 240 });
  const item = { Id: 3, itemId: 4, unit: 'Pcs', unitValue: 100, cost: 250 };
  assert.equal(currentAverage('ItemStock', item), 2.5);
  const used = outbound('ItemStock', item, { quantity: 40 });
  assert.equal(used.totalCost, 100);
  assert.deepEqual(used.fields, { cost: 150 });
});

test('a legacy row without averageCost falls back to its purchase price', () => {
  assert.equal(currentAverage('ProductStock', { quantity: 5, purchase_price: 184 }), 184);
  assert.deepEqual(revalue('ProductStock', { quantity: 5, averageCost: 184 }, { average: 190.5 }).fields,
    { averageCost: 190.5, purchase_price: 191 });
});

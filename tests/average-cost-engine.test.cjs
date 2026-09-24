const test = require('node:test');
const assert = require('node:assert/strict');
const { replayAverages } = require('../shared/averageCostEngine');

let id = 0;
const mv = (extra) => ({ Id: ++id, operation: 'CREATE', createdAt: `2026-10-01 10:00:${String(id).padStart(2, '0')}`, averageCostAfter: null, unitCost: null, unitCostConsumed: null, ...extra });
const product = (qty, avg) => ({ ProductStock: [{ Id: 1, productId: 5, name: 'Fan', quantity: qty, averageCost: avg, purchase_price: avg }] });

test('buy 5 @10 then 5 @20 → average 15; sale costs 15; sales return re-enters at the sale cost', () => {
  id = 0;
  const movements = [
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReceivedProduct', sourceId: 1, date: '2026-10-02', quantityChange: 5, unitCost: 20 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-03', quantityChange: -4 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReceivedProduct', sourceId: 2, date: '2026-10-04', quantityChange: 4, unitCost: 30 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReturnProduct', sourceId: 3, date: '2026-10-05', quantityChange: 1 }),
  ];
  // live now: 5 + 5 − 4 + 4 + 1 = 11
  const { updates, averages, documentCost } = replayAverages({ movements, stocksByType: product(11, 10), fromDate: '2026-10-01' });
  assert.equal(updates.get(1).averageCostAfter, 15);
  assert.equal(updates.get(2).unitCostConsumed, 15);
  assert.equal(documentCost.get('InTransitProduct:9'), 60);
  assert.equal(updates.get(3).averageCostAfter, 21);          // (6×15 + 4×30) / 10
  assert.equal(updates.get(4).unitCost, 15);                  // return at last sale cost
  assert.equal(averages.get('ProductStock:product:5').average, 20.4545);
});

test('a backdated purchase re-costs the later sale in the open month', () => {
  id = 0;
  const movements = [
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-05', quantityChange: -5, createdAt: '2026-10-05 09:00:00' }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReceivedProduct', sourceId: 1, date: '2026-10-02', quantityChange: 10, unitCost: 40, createdAt: '2026-10-06 09:00:00' }),
  ];
  // opening 10 @ 10; live 15
  const { documentCost } = replayAverages({ movements, stocksByType: product(15, 10), fromDate: '2026-10-01' });
  assert.equal(documentCost.get('InTransitProduct:9'), 125);  // 5 × ((10×10 + 10×40)/20 = 25)
});

test('deleting a purchase un-blends at its own cost; deleting a sale restores at the sale cost', () => {
  id = 0;
  const movements = [
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReceivedProduct', sourceId: 1, date: '2026-10-02', quantityChange: 10, unitCost: 30 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReceivedProduct', sourceId: 1, date: '2026-10-02', quantityChange: -10, operation: 'DELETE' }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-03', quantityChange: -2 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-03', quantityChange: 2, operation: 'DELETE' }),
  ];
  const { updates, documentCost } = replayAverages({ movements, stocksByType: product(10, 10), fromDate: '2026-10-01' });
  assert.equal(updates.get(2).averageCostAfter, 10);          // back to the opening average
  assert.equal(updates.get(4).unitCost, 10);
  assert.equal(documentCost.get('InTransitProduct:9'), 0);
});

test('a damage transfer carries the product average into damage stock', () => {
  id = 0;
  const stocksByType = { ...product(8, 25), DamageStock: [{ Id: 2, productId: 5, name: 'Fan', quantity: 2, purchase_price: 0 }] };
  const movements = [
    mv({ stockType: 'DamageStock', productId: 5, sourceType: 'DamageProduct', sourceId: 4, date: '2026-10-03', quantityChange: 2 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'DamageProduct', sourceId: 4, date: '2026-10-03', quantityChange: -2 }),
  ];
  const { updates, averages } = replayAverages({ movements, stocksByType, fromDate: '2026-10-01' });
  assert.equal(updates.get(2).unitCostConsumed, 25);
  assert.equal(updates.get(1).unitCost, 25);
  assert.equal(averages.get('DamageStock:product:5').average, 25);
});

test('closed months keep stored averages; the open month starts from the last stored one', () => {
  id = 0;
  const movements = [
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReceivedProduct', sourceId: 1, date: '2026-09-20', quantityChange: 10, unitCost: 50, averageCostAfter: 30, createdAt: '2026-09-20 10:00:00' }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-02', quantityChange: -1 }),
  ];
  const { updates } = replayAverages({ movements, stocksByType: product(9, 99), fromDate: '2026-10-01' });
  assert.equal(updates.has(1), false);
  assert.equal(updates.get(2).unitCostConsumed, 30);
});

test('the purchase document price wins, so a price-only edit re-costs later sales', () => {
  id = 0;
  const movements = [
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'ReceivedProduct', sourceId: 1, date: '2026-10-02', quantityChange: 10, unitCost: 20 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-03', quantityChange: -10 }),
  ];
  const documentUnitCost = new Map([['ReceivedProduct:1', 40]]);   // edited from 20 to 40
  const { documentCost } = replayAverages({ movements, stocksByType: product(10, 10), fromDate: '2026-10-01', documentUnitCost });
  assert.equal(documentCost.get('InTransitProduct:9'), 250);        // 10 × (10×10 + 10×40)/20
});

test('movements before the go-live seed are never re-costed; the seed average is the start', () => {
  id = 0;
  const movements = [
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 8, date: '2026-10-02', quantityChange: -1 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'AverageCostGoLive', operation: 'AVERAGE_SEED', date: '2026-10-02', quantityChange: 0, averageCostAfter: 40 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-02', quantityChange: -1 }),
  ];
  const { updates, documentCost } = replayAverages({ movements, stocksByType: product(8, 99), fromDate: '2026-10-01', costedAfterId: 2 });
  assert.equal(updates.has(1), false);
  assert.equal(documentCost.get('InTransitProduct:9'), 40);
});

test('an admin revaluation resets the average from that point on', () => {
  id = 0;
  const movements = [
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'PriceRevaluation', sourceId: 1, operation: 'REVALUATION', date: '2026-10-02', quantityChange: 0, averageCostAfter: 50 }),
    mv({ stockType: 'ProductStock', productId: 5, sourceType: 'InTransitProduct', sourceId: 9, date: '2026-10-03', quantityChange: -2 }),
  ];
  const { documentCost, averages } = replayAverages({ movements, stocksByType: product(8, 10), fromDate: '2026-10-01' });
  assert.equal(documentCost.get('InTransitProduct:9'), 100);
  assert.equal(averages.get('ProductStock:product:5').average, 50);
});

test('after a factory edit the transfer enters at the edited outbound cost', () => {
  id = 0;
  const stocksByType = {
    ItemStock: [{ Id: 3, itemId: 4, name: 'Bottle', unit: 'Pcs', unitValue: 80, cost: 800 }],
    FactoryStock: [{ Id: 7, itemId: 4, manufacturerId: 2, name: 'Bottle', unit: 'Pcs', unitValue: 120, cost: 0 }],
  };
  const movements = [
    mv({ stockType: 'ItemStock', itemId: 4, stockRowId: 3, sourceType: 'ItemPurchase', sourceId: 1, date: '2026-10-02', quantityChange: 100, unitCost: 20 }),
    mv({ stockType: 'ItemStock', itemId: 4, stockRowId: 3, sourceType: 'Factory', sourceId: 5, date: '2026-10-03', quantityChange: -100 }),
    mv({ stockType: 'FactoryStock', itemId: 4, stockRowId: 7, sourceType: 'Factory', sourceId: 5, date: '2026-10-03', quantityChange: 100 }),
    mv({ stockType: 'ItemStock', itemId: 4, stockRowId: 3, sourceType: 'Factory', sourceId: 5, date: '2026-10-03', quantityChange: 100, operation: 'UPDATE_REVERSE' }),
    mv({ stockType: 'FactoryStock', itemId: 4, stockRowId: 7, sourceType: 'Factory', sourceId: 5, date: '2026-10-03', quantityChange: -100, operation: 'UPDATE_REVERSE' }),
    mv({ stockType: 'ItemStock', itemId: 4, stockRowId: 3, sourceType: 'Factory', sourceId: 5, date: '2026-10-03', quantityChange: -120, operation: 'UPDATE_APPLY' }),
    mv({ stockType: 'FactoryStock', itemId: 4, stockRowId: 7, sourceType: 'Factory', sourceId: 5, date: '2026-10-03', quantityChange: 120, operation: 'UPDATE_APPLY' }),
  ];
  // opening item stock 100 @ 10, live item 80, factory 120
  const { averages } = replayAverages({ movements, stocksByType, fromDate: '2026-10-01' });
  assert.equal(averages.get('ItemStock:row:3').average, 15);
  assert.equal(averages.get('FactoryStock:row:7').average, 15);
});

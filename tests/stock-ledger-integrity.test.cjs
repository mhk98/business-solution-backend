const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const modelsPath = path.resolve(__dirname, '../models/index.js');
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: {} };
const { findLedgerMismatches } = require('../shared/stockLedgerIntegrity');

const mv = (Id, extra) => ({ Id, operation: 'CREATE', date: '2026-09-20', ...extra });

test('a stock change missing from the ledger is reported per stock row', () => {
  const stocksByType = {
    ProductStock: [{ Id: 1, productId: 5, name: 'Fan', quantity: 40 }],
    DamageStock: [{ Id: 2, productId: 5, name: 'Fan', quantity: 3 }],
    ItemStock: [{ Id: 9, itemId: 4, name: 'Bottle', unitValue: 100 }],
  };
  const movements = [
    mv(1, { stockType: 'ProductStock', productId: 5, quantityChange: 50 }),
    mv(2, { stockType: 'ProductStock', productId: 5, quantityChange: -10 }),
    mv(3, { stockType: 'DamageStock', productId: 5, quantityChange: 5 }), // live says 3
    mv(4, { stockType: 'PackagingStock', itemId: 4, stockRowId: 9, quantityChange: 100 }),
    mv(5, { stockType: 'ProductStock', productId: 5, operation: 'OPENING_BALANCE', quantityChange: 999 }),
  ];
  assert.deepEqual(findLedgerMismatches({ stocksByType, movements }),
    [{ key: 'DamageStock:product:5', type: 'DamageStock', name: 'Fan', ledger: 5, live: 3 }]);
});

test('rows superseded by a history rebuild are ignored', () => {
  const stocksByType = { ProductStock: [{ Id: 1, productId: 5, name: 'Fan', quantity: 7 }] };
  const movements = [
    mv(1, { stockType: 'ProductStock', productId: 5, quantityChange: 999 }),
    mv(2, { stockType: 'ProductStock', productId: 5, quantityChange: 7, operation: 'REBUILD' }),
    mv(3, { stockType: 'HistoryRebuild', operation: 'HISTORY_REBUILD', quantityChange: 0, metadata: JSON.stringify({ supersedesThroughId: 1 }) }),
  ];
  assert.deepEqual(findLedgerMismatches({ stocksByType, movements }), []);
});

test('a deleted stock row whose movements do not net to zero is reported as live 0', () => {
  const stocksByType = { ItemStock: [{ Id: 9, itemId: 4, name: 'Bottle', unitValue: 5 }] };
  const movements = [
    mv(1, { stockType: 'ItemStock', itemId: 4, stockRowId: 9, quantityChange: 5 }),
    mv(2, { stockType: 'ItemStock', itemId: 7, stockRowId: 21, name: 'Tape', quantityChange: 75 }),   // row 21 deleted
  ];
  const [gap] = findLedgerMismatches({ stocksByType, movements });
  assert.equal(gap.ledger, 75);
  assert.equal(gap.live, 0);
  assert.equal(gap.orphan.Id, 21);
});

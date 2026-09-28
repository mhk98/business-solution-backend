const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Op } = require('sequelize');
const ApiError = require('../error/ApiError');

const rows = [];
let tail = Promise.resolve();
let failCreate = false;
const db = {
  Sequelize: require('sequelize'),
  sequelize: {
    transaction: async (run) => {
      let release;
      const previous = tail;
      tail = new Promise(resolve => { release = resolve; });
      const t = { LOCK: { UPDATE: 'UPDATE' } };
      t.acquire = () => previous;
      try { return await run(t); } finally { release(); }
    },
  },
  book: {
    findByPk: async (id, options) => {
      assert.equal(options.lock, 'UPDATE');
      await options.transaction.acquire();
      return { Id: id };
    },
  },
  category: { findByPk: async id => ({ Id: id,
    name: Number(id) === 3 ? 'Bkash Ltd. Trust Payment' : 'Other category' }) },
  supplierHistory: { create: async () => ({}) },
  cashInOut: {
    count: async () => rows.length,
    findAll: async ({ where, transaction, lock }) => {
      assert.ok(transaction);
      assert.equal(lock, 'UPDATE');
      return rows.filter(row => Number(row.bookId) === where.bookId
        && row.createdAt > where.createdAt[Op.gt]);
    },
    create: async data => {
      if (failCreate) throw new Error('write failed');
      const row = { ...data, Id: rows.length + 1, createdAt: new Date() };
      rows.push(row);
      return row;
    },
  },
};
const source = fs.readFileSync('app/modules/cashInOut/cashInOut.service.js', 'utf8');
const insert = vm.runInNewContext(
  source.slice(0, source.indexOf('// Fund transfers affect mode balances')) + '\ninsertIntoDB;',
  { require: name => name === '../../../models' ? db
    : name === '../../../error/ApiError' ? ApiError
    : name === 'sequelize' ? { Op } : {}, Date },
);
const base = { bookId: 1, categoryId: 3, amount: 6800.88,
  date: '2026-09-09', paymentMode: 'Bank', paymentStatus: 'CashIn',
  note: 'Received from Bkash', status: 'Pending' };
const duplicate = error => error.statusCode === 409;

(async () => {
  await insert(base);
  await assert.rejects(insert({ ...base, amount: '6800.880', bookId: '1',
    file: 'new-upload.pdf', voucherPrefix: 'OTHER', status: 'Active' }), duplicate);
  assert.equal(rows.length, 1);

  // Fields outside the marked columns must not bypass duplicate protection.
  for (const change of [{ bankAccount: 4 }, { bankName: 'Another bank' },
    { remarks: 'Updated remarks' }, { refNo: 'Different reference' },
    { fromParty: 'Another name' }, { receiverName: 'Another receiver' },
    { lender: 'Another lender' }, { employeeId: 9 }]) {
    await assert.rejects(insert({ ...base, ...change }), duplicate);
  }

  // Changing any marked column, or the book, allows a new transaction.
  for (const change of [{ amount: 6801 }, { paymentStatus: 'CashOut' },
    { date: '2026-09-10' }, { categoryId: 4 }, { supplierId: 8 },
    { paymentMode: 'Cash' }, { bookId: 2 }, { note: 'Another payment' }]) {
    await insert({ ...base, ...change });
  }
  rows[0].createdAt = new Date(Date.now() - 60_001);
  await insert(base);

  rows.length = 0;
  const concurrent = await Promise.allSettled([insert(base), insert(base)]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(rows.length, 1);

  rows.length = 0;
  failCreate = true;
  await assert.rejects(insert(base), /write failed/);
  failCreate = false;
  await insert(base);
  assert.equal(rows.length, 1);
  console.log('PASS: duplicate window, normalization, distinct payments, concurrent requests, failed-write retry');
})().catch(error => { console.error(error); process.exitCode = 1; });

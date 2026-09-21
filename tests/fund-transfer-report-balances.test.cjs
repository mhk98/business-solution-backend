const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const Op = { lt: Symbol(), lte: Symbol(), ne: Symbol(), is: Symbol(), in: Symbol() };
const entries = [
  { date: '2026-07-28', bookId: 1, amount: 390010, status: 'Active' },
  { date: '2026-09-01', bookId: 1, amount: 900, status: 'Active' },
  { date: '2026-07-28', bookId: 1, amount: 500, status: 'Inactive' },
  { date: '2026-07-28', bookId: 1, amount: 700, status: 'Active', deleted: true },
];
const db = {
  Sequelize: { fn() {}, col() {} },
  fundTransfer: { findAll: async ({ where, paranoid }) => {
    assert.equal(paranoid, true);
    return entries.filter(r => !r.deleted && r.status === where.status &&
      (!where.date || Reflect.ownKeys(where.date).every(k => k === Op.lt ? r.date < where.date[k] : r.date <= where.date[k])) &&
      (typeof where.bookId !== 'number' || r.bookId === where.bookId))
      .map(r => ({ fromPaymentMode: 'Bank', toPaymentMode: 'Cash', total: r.amount }));
  } },
};
const moduleStub = { exports: {} };
vm.runInNewContext(fs.readFileSync('shared/fundTransferPaymentModes.js', 'utf8'), { require: () => db, module: moduleStub });
const { getFundTransferPaymentModeRows } = moduleStub.exports;
const source = fs.readFileSync('app/modules/inventoryOverview/inventoryOverview.service.js', 'utf8');
const start = source.indexOf('const getCashBalanceByPaymentMode =');
const end = source.indexOf('\n};', start) + 3;
const getBalance = vm.runInNewContext(source.slice(start, end) + '\ngetCashBalanceByPaymentMode', {
  db, Op, n: Number, getFundTransferPaymentModeRows,
  CashInOut: { findAll: async () => [
    { paymentMode: 'Bank', paymentStatus: 'CashIn', total: 702134.13 },
    { paymentMode: 'Cash', paymentStatus: 'CashIn', total: 3151131 },
  ] },
});
(async () => {
  for (const date of [{ [Op.lt]: '2026-08-01' }, { [Op.lte]: '2026-08-31' }]) {
    const balances = Object.fromEntries((await getBalance({ date })).map(r => [r.mode, r.amount]));
    assert.equal(balances.Bank, 312124.13);
    assert.equal(balances.Cash, 3541141);
    assert.equal(balances.Bank + balances.Cash, 3853265.13);
  }
  const before = await getFundTransferPaymentModeRows({ date: { [Op.lt]: '2026-07-28' } });
  assert.equal(before.length, 0);
  const otherBook = await getFundTransferPaymentModeRows({ bookId: 2 });
  assert.equal(otherBook.length, 0);
  console.log('PASS: transfer reduces Bank and increases Cash, preserves total, respects date/book/status/deletion.');
})().catch(e => { console.error(e); process.exitCode = 1; });

const { Op } = require("sequelize");
const db = require("../../../models");
const BankAccountService = require("../bankAccount/bankAccount.service");
const BookService = require("../book/book.service");

const CashInOut = db.cashInOut;
const FundTransfer = db.fundTransfer;

// Per payment mode (Bkash/Nagad/Rocket/Card…) aggregate across all CashInOut
// entries tagged with that mode — including entries recorded before wallet
// accounts existed, which carry no account number. Per-account wallet
// balances are returned separately as `walletAccounts`.
const getWalletBalances = async () => {
  const rows = await CashInOut.findAll({
    attributes: [
      "paymentMode",
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal(
            "CASE WHEN paymentStatus = 'CashIn' THEN amount WHEN paymentStatus = 'CashOut' THEN -amount ELSE 0 END",
          ),
        ),
        "net",
      ],
    ],
    where: {
      paymentMode: { [Op.notIn]: ["Bank", "Cash"], [Op.ne]: null },
    },
    group: ["paymentMode"],
    raw: true,
  });

  // Fund transfers move money into/out of a wallet mode too (e.g. Bank →
  // Bkash), so fold them in per mode.
  const [transfersOut, transfersIn] = FundTransfer
    ? await Promise.all([
        FundTransfer.findAll({
          attributes: [
            "fromPaymentMode",
            [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
          ],
          where: { fromPaymentMode: { [Op.notIn]: ["Bank", "Cash"], [Op.ne]: null } },
          group: ["fromPaymentMode"],
          raw: true,
        }),
        FundTransfer.findAll({
          attributes: [
            "toPaymentMode",
            [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
          ],
          where: { toPaymentMode: { [Op.notIn]: ["Bank", "Cash"], [Op.ne]: null } },
          group: ["toPaymentMode"],
          raw: true,
        }),
      ])
    : [[], []];

  const byMode = new Map();
  const add = (mode, value) => {
    if (!mode) return;
    byMode.set(mode, (byMode.get(mode) || 0) + Number(value || 0));
  };
  rows.forEach((row) => add(row.paymentMode, row.net));
  transfersIn.forEach((row) => add(row.toPaymentMode, row.total));
  transfersOut.forEach((row) => add(row.fromPaymentMode, -Number(row.total || 0)));

  return [...byMode.entries()].map(([paymentMode, balance]) => ({
    paymentMode,
    balance,
  }));
};

const getSummary = async () => {
  const [bankAccounts, books, cashBalancesByBook, wallets] = await Promise.all([
    BankAccountService.getAllFromDBWithoutQuery(),
    BookService.getAllFromDBWithoutQuery(),
    BookService.getCashBalancesByBook(),
    getWalletBalances(),
  ]);

  const cashByBook = books.map((book) => {
    const plain = book.get ? book.get({ plain: true }) : book;
    return {
      bookId: plain.Id,
      bookName: plain.name,
      balance: cashBalancesByBook.get(plain.Id) || 0,
    };
  });

  const toRow = (account) => ({
    Id: account.Id,
    accountType: account.accountType || "Bank",
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    balance: account.balance,
  });
  const bankAccountRows = bankAccounts
    .filter((account) => (account.accountType || "Bank") === "Bank")
    .map(toRow);
  const walletAccountRows = bankAccounts
    .filter((account) => (account.accountType || "Bank") !== "Bank")
    .map(toRow);

  return {
    bankAccounts: bankAccountRows,
    totalBank: bankAccountRows.reduce((sum, row) => sum + row.balance, 0),
    cashByBook,
    totalCash: cashByBook.reduce((sum, row) => sum + row.balance, 0),
    wallets,
    walletAccounts: walletAccountRows,
  };
};

module.exports = { getSummary };

const { Op } = require("sequelize");
const db = require("../../../models");
const BankAccountService = require("../bankAccount/bankAccount.service");
const BookService = require("../book/book.service");

const CashInOut = db.cashInOut;

// Bkash/Nagad/Rocket/Card etc. have no dedicated account table (unlike Bank),
// so each payment mode's balance is a single aggregate across all CashInOut
// entries tagged with that mode.
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

  return rows
    .filter((row) => row.paymentMode)
    .map((row) => ({
      paymentMode: row.paymentMode,
      balance: Number(row.net || 0),
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

  const bankAccountRows = bankAccounts.map((account) => ({
    Id: account.Id,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    balance: account.balance,
  }));

  return {
    bankAccounts: bankAccountRows,
    totalBank: bankAccountRows.reduce((sum, row) => sum + row.balance, 0),
    cashByBook,
    totalCash: cashByBook.reduce((sum, row) => sum + row.balance, 0),
    wallets,
  };
};

module.exports = { getSummary };

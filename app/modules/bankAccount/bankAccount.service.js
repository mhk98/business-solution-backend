const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const BankAccount = db.bankAccount;
const CashInOut = db.cashInOut;
const FundTransfer = db.fundTransfer;
const ApiError = require("../../../error/ApiError");
const { ACCOUNT_TYPES } = require("./bankAccount.constants");

const normalizeAccountType = (value, fallback = "Bank") => {
  if (value === undefined || value === null || value === "") return fallback;
  const match = ACCOUNT_TYPES.find(
    (type) => type.toLowerCase() === String(value).trim().toLowerCase(),
  );
  if (!match) {
    throw new ApiError(
      400,
      `Account type must be one of: ${ACCOUNT_TYPES.join(", ")}`,
    );
  }
  return match;
};

const insertIntoDB = async (data) => {
  const result = await BankAccount.create({
    ...data,
    accountType: normalizeAccountType(data.accountType),
  });
  return result;
};

// Balance is computed on the fly (no stored running balance) so it can never
// drift out of sync with the underlying CashInOut / FundTransfer rows.
// CashInOut's `bankAccount` column historically stores the account NUMBER
// (not the BankAccount.Id), so it is matched by payment mode + accountNumber
// here (a Bkash wallet and a bank account may share a number); FundTransfer
// uses a proper bankAccount.Id foreign key.
const getBalancesByAccountNumberAndId = async () => {
  const [cashInOutRows, transferOutRows, transferInRows] = await Promise.all([
    CashInOut.findAll({
      attributes: [
        "paymentMode",
        "bankAccount",
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
        paymentMode: { [Op.in]: ACCOUNT_TYPES },
        bankAccount: { [Op.ne]: null },
      },
      group: ["paymentMode", "bankAccount"],
      raw: true,
    }),
    FundTransfer
      ? FundTransfer.findAll({
          attributes: [
            "fromBankAccount",
            [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "totalOut"],
          ],
          where: {
            fromPaymentMode: { [Op.in]: ACCOUNT_TYPES },
            fromBankAccount: { [Op.ne]: null },
          },
          group: ["fromBankAccount"],
          raw: true,
        })
      : [],
    FundTransfer
      ? FundTransfer.findAll({
          attributes: [
            "toBankAccount",
            [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "totalIn"],
          ],
          where: {
            toPaymentMode: { [Op.in]: ACCOUNT_TYPES },
            toBankAccount: { [Op.ne]: null },
          },
          group: ["toBankAccount"],
          raw: true,
        })
      : [],
  ]);

  const cashKey = (mode, number) =>
    `${String(mode || "").toLowerCase()}|${String(number)}`;
  const netByAccountNumber = new Map();
  cashInOutRows.forEach((row) => {
    const key = cashKey(row.paymentMode, row.bankAccount);
    netByAccountNumber.set(
      key,
      (netByAccountNumber.get(key) || 0) + Number(row.net || 0),
    );
  });

  const outById = new Map();
  transferOutRows.forEach((row) => {
    outById.set(String(row.fromBankAccount), Number(row.totalOut || 0));
  });

  const inById = new Map();
  transferInRows.forEach((row) => {
    inById.set(String(row.toBankAccount), Number(row.totalIn || 0));
  });

  return { netByAccountNumber, outById, inById, cashKey };
};

const attachBalances = async (bankAccounts) => {
  const { netByAccountNumber, outById, inById, cashKey } =
    await getBalancesByAccountNumberAndId();

  return bankAccounts.map((account) => {
    const plain = account.get ? account.get({ plain: true }) : account;
    const fromCashInOut =
      netByAccountNumber.get(
        cashKey(plain.accountType || "Bank", plain.accountNumber),
      ) || 0;
    const fromTransfersIn = inById.get(String(plain.Id)) || 0;
    const fromTransfersOut = outById.get(String(plain.Id)) || 0;

    return {
      ...plain,
      balance: fromCashInOut + fromTransfersIn - fromTransfersOut,
    };
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      [Op.or]: [
        { bankName: { [Op.like]: `%${searchTerm}%` } },
        { accountNumber: { [Op.like]: `%${searchTerm}%` } },
      ],
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      [Op.and]: Object.entries(filterData).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await BankAccount.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await BankAccount.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: await attachBalances(result),
  };
};

const getDataById = async (id) => {
  const result = await BankAccount.findOne({
    where: { Id: id },
  });
  if (!result) return result;

  const [withBalance] = await attachBalances([result]);
  return withBalance;
};

const deleteIdFromDB = async (id) => {
  const result = await BankAccount.destroy({
    where: { Id: id },
  });
  return result;
};

const updateOneFromDB = async (id, payload) => {
  const data = { ...payload };
  if (data.accountType !== undefined) {
    data.accountType = normalizeAccountType(data.accountType);
  }
  const result = await BankAccount.update(data, {
    where: { Id: id },
  });
  return result;
};

const getAllFromDBWithoutQuery = async (filters = {}) => {
  const where = {};
  if (filters.accountType) {
    where.accountType = normalizeAccountType(filters.accountType);
  }
  const result = await BankAccount.findAll({
    where,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return attachBalances(result);
};

const BankAccountService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = BankAccountService;

const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const OwnerTransaction = db.ownerTransaction;
const Owner = db.owner;
const Book = db.book;
const CashInOut = db.cashInOut;

const CATEGORY = "Owner Transaction";

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const normalizeAmount = (value) => {
  const numberValue = Number(value || 0);
  if (!numberValue || Number.isNaN(numberValue) || numberValue <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }
  return numberValue;
};

const normalizeType = (value) => {
  const type = String(value || "Deposit").trim();
  if (!["Deposit", "Withdraw"].includes(type)) {
    throw new ApiError(400, "Type must be Deposit or Withdraw");
  }
  return type;
};

const ensureOwnerAndBook = async ({ ownerId, bookId }, transaction) => {
  const [owner, book] = await Promise.all([
    Owner.findByPk(ownerId, { transaction }),
    Book.findByPk(bookId, { transaction }),
  ]);

  if (!owner) throw new ApiError(404, "Owner not found");
  if (!book) throw new ApiError(404, "Book not found");

  return { owner, book };
};

const buildCashInOutPayload = ({ owner, transactionData }) => ({
  bookId: transactionData.bookId,
  paymentMode: "Cash",
  paymentStatus: transactionData.type === "Deposit" ? "CashIn" : "CashOut",
  amount: transactionData.amount,
  remarks: transactionData.remarks || "",
  note: transactionData.remarks || "",
  category: CATEGORY,
  date: transactionData.date,
  status: transactionData.status || "Active",
  lender: owner.name,
  loanId: null,
  supplierId: null,
});

const normalizePayload = (payload, existing = {}) => ({
  ownerId:
    normalizeOptionalId(payload.ownerId) ||
    normalizeOptionalId(existing.ownerId),
  bookId:
    normalizeOptionalId(payload.bookId) || normalizeOptionalId(existing.bookId),
  type: normalizeType(payload.type || existing.type),
  amount:
    payload.amount !== undefined
      ? normalizeAmount(payload.amount)
      : normalizeAmount(existing.amount),
  remarks: payload.remarks ?? existing.remarks ?? "",
  date:
    (payload.date && String(payload.date).slice(0, 10)) ||
    existing.date ||
    new Date().toISOString().slice(0, 10),
  status: payload.status || existing.status || "Active",
});

const insertIntoDB = async (payload) =>
  db.sequelize.transaction(async (transaction) => {
    const transactionData = normalizePayload(payload);
    const { owner } = await ensureOwnerAndBook(transactionData, transaction);

    const cashInOut = await CashInOut.create(
      buildCashInOutPayload({ owner, transactionData }),
      { transaction },
    );

    return OwnerTransaction.create(
      {
        ...transactionData,
        cashInOutId: cashInOut.Id,
      },
      { transaction },
    );
  });

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const {
    searchTerm,
    startDate,
    endDate,
    ownerId,
    bookId,
    type,
    status,
  } = filters;
  const andConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    andConditions.push({
      [Op.or]: [
        { remarks: { [Op.like]: `%${term}%` } },
        { type: { [Op.like]: `%${term}%` } },
        { "$owner.name$": { [Op.like]: `%${term}%` } },
        { "$book.name$": { [Op.like]: `%${term}%` } },
        db.Sequelize.where(db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"), {
          [Op.like]: `%${term}%`,
        }),
      ],
    });
  }

  if (startDate && endDate) {
    andConditions.push({ date: { [Op.between]: [startDate, endDate] } });
  } else if (startDate) {
    andConditions.push({ date: { [Op.gte]: startDate } });
  } else if (endDate) {
    andConditions.push({ date: { [Op.lte]: endDate } });
  }

  if (ownerId) andConditions.push({ ownerId: { [Op.eq]: ownerId } });
  if (bookId) andConditions.push({ bookId: { [Op.eq]: bookId } });
  if (type) andConditions.push({ type: { [Op.eq]: type } });
  if (status) andConditions.push({ status: { [Op.eq]: status } });

  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const include = [
    { model: Owner, as: "owner", required: false },
    { model: Book, as: "book", required: false },
  ];

  const [data, count, totalDeposit, totalWithdraw] = await Promise.all([
    OwnerTransaction.findAll({
      where,
      include,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"]],
    }),
    OwnerTransaction.count({ where, include, distinct: true }),
    OwnerTransaction.sum("amount", {
      where: { [Op.and]: [...andConditions, { type: "Deposit" }] },
      include,
    }),
    OwnerTransaction.sum("amount", {
      where: { [Op.and]: [...andConditions, { type: "Withdraw" }] },
      include,
    }),
  ]);

  const deposit = Number(totalDeposit || 0);
  const withdraw = Number(totalWithdraw || 0);

  return {
    meta: {
      count,
      page,
      limit,
      totalDeposit: deposit,
      totalWithdraw: withdraw,
      netBalance: deposit - withdraw,
    },
    data,
  };
};

const getDataById = async (id) =>
  OwnerTransaction.findOne({
    where: { Id: id },
    include: [
      { model: Owner, as: "owner", required: false },
      { model: Book, as: "book", required: false },
    ],
  });

const updateOneFromDB = async (id, payload) =>
  db.sequelize.transaction(async (transaction) => {
    const existing = await OwnerTransaction.findByPk(id, { transaction });
    if (!existing) throw new ApiError(404, "Owner transaction not found");

    const transactionData = normalizePayload(payload, existing);
    const { owner } = await ensureOwnerAndBook(transactionData, transaction);
    const cashPayload = buildCashInOutPayload({ owner, transactionData });

    let cashInOutId = existing.cashInOutId;
    if (cashInOutId) {
      const [updated] = await CashInOut.update(cashPayload, {
        where: { Id: cashInOutId },
        transaction,
      });
      if (!updated) cashInOutId = null;
    }

    if (!cashInOutId) {
      const cashInOut = await CashInOut.create(cashPayload, { transaction });
      cashInOutId = cashInOut.Id;
    }

    await existing.update(
      {
        ...transactionData,
        cashInOutId,
      },
      { transaction },
    );

    return existing;
  });

const deleteIdFromDB = async (id) =>
  db.sequelize.transaction(async (transaction) => {
    const existing = await OwnerTransaction.findByPk(id, { transaction });
    if (!existing) return 0;

    if (existing.cashInOutId) {
      await CashInOut.destroy({
        where: { Id: existing.cashInOutId },
        transaction,
      });
    }

    return existing.destroy({ transaction });
  });

const getAllFromDBWithoutQuery = async () =>
  OwnerTransaction.findAll({
    include: [
      { model: Owner, as: "owner", required: false },
      { model: Book, as: "book", required: false },
    ],
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

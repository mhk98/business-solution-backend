const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const FundTransfer = db.fundTransfer;
const Book = db.book;
const BankAccount = db.bankAccount;

const toDateOnly = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMonthRange = (value) => {
  const sourceDate = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
  const year = safeDate.getFullYear();
  const month = safeDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    date: formatDateOnly(safeDate),
    start: formatDateOnly(start),
    end: formatDateOnly(end),
  };
};

const generateMonthlyVoucherNo = async (date, transaction) => {
  const prefix = "FT-";
  const { start, end, date: normalizedDate } = getMonthRange(date);
  const count = await FundTransfer.count({
    where: {
      voucherNo: { [Op.like]: `${prefix}%` },
      date: { [Op.between]: [start, end] },
    },
    paranoid: true,
    transaction,
  });

  const [year, month] = normalizedDate.split("-");
  const monthYearSuffix = `${month}${year.slice(-2)}`;

  return `${prefix}${String(count + 1).padStart(4, "0")}${monthYearSuffix}`;
};

const insertIntoDB = async (data) => {
  const {
    bookId,
    date,
    fromPaymentMode,
    fromBankAccount,
    fromBankName,
    toPaymentMode,
    toBankAccount,
    toBankName,
    amount,
    note,
    remarks,
    status,
  } = data;

  return db.sequelize.transaction(async (t) => {
    const book = await Book.findByPk(bookId, { transaction: t });
    if (!book) throw new ApiError(404, "Book not found");

    if (fromPaymentMode === "Bank") {
      const bank = await BankAccount.findByPk(fromBankAccount, {
        transaction: t,
      });
      if (!bank) throw new ApiError(404, "From bank account not found");
    }

    if (toPaymentMode === "Bank") {
      const bank = await BankAccount.findByPk(toBankAccount, {
        transaction: t,
      });
      if (!bank) throw new ApiError(404, "To bank account not found");
    }

    const isSameAccount =
      fromPaymentMode === toPaymentMode &&
      (fromPaymentMode !== "Bank" ||
        Number(fromBankAccount) === Number(toBankAccount));
    if (isSameAccount) {
      throw new ApiError(400, "From and To account cannot be the same");
    }

    const voucherNo = await generateMonthlyVoucherNo(date, t);
    const { date: normalizedDate } = getMonthRange(date);

    const result = await FundTransfer.create(
      {
        bookId,
        date: date || normalizedDate,
        fromPaymentMode,
        fromBankAccount: fromPaymentMode === "Bank" ? fromBankAccount : null,
        fromBankName: fromPaymentMode === "Bank" ? fromBankName || "" : "",
        toPaymentMode,
        toBankAccount: toPaymentMode === "Bank" ? toBankAccount : null,
        toBankName: toPaymentMode === "Bank" ? toBankName || "" : "",
        amount,
        voucherNo,
        note: note || null,
        remarks: remarks || "",
        status: status || "Active",
      },
      { transaction: t },
    );

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const {
    searchTerm,
    startDate,
    endDate,
    bookId,
    fromPaymentMode,
    toPaymentMode,
    fromBankAccount,
    toBankAccount,
    voucherNo,
    status,
  } = filters;

  const baseConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    baseConditions.push({
      [Op.or]: [
        { note: { [Op.like]: `%${term}%` } },
        { remarks: { [Op.like]: `%${term}%` } },
        { voucherNo: { [Op.like]: `%${term}%` } },
        { fromBankName: { [Op.like]: `%${term}%` } },
        { toBankName: { [Op.like]: `%${term}%` } },
        { fromPaymentMode: { [Op.like]: `%${term}%` } },
        { toPaymentMode: { [Op.like]: `%${term}%` } },
        { status: { [Op.like]: `%${term}%` } },
        db.Sequelize.where(
          db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"),
          { [Op.like]: `%${term}%` },
        ),
      ],
    });
  }

  if (startDate && endDate) {
    baseConditions.push({
      date: { [Op.between]: [toDateOnly(startDate), toDateOnly(endDate)] },
    });
  } else if (startDate) {
    baseConditions.push({ date: { [Op.gte]: toDateOnly(startDate) } });
  } else if (endDate) {
    baseConditions.push({ date: { [Op.lte]: toDateOnly(endDate) } });
  }

  if (bookId) baseConditions.push({ bookId: { [Op.eq]: bookId } });
  if (fromPaymentMode)
    baseConditions.push({ fromPaymentMode: { [Op.eq]: fromPaymentMode } });
  if (toPaymentMode)
    baseConditions.push({ toPaymentMode: { [Op.eq]: toPaymentMode } });
  if (fromBankAccount)
    baseConditions.push({ fromBankAccount: { [Op.eq]: fromBankAccount } });
  if (toBankAccount)
    baseConditions.push({ toBankAccount: { [Op.eq]: toBankAccount } });
  if (status) baseConditions.push({ status: { [Op.eq]: status } });
  if (voucherNo && String(voucherNo).trim()) {
    baseConditions.push({
      voucherNo: { [Op.like]: `%${String(voucherNo).trim()}%` },
    });
  }

  const where = baseConditions.length ? { [Op.and]: baseConditions } : {};

  const [data, count, totalTransferred] = await Promise.all([
    FundTransfer.findAll({
      where,
      include: [
        { model: Book, as: "book", required: false },
        { model: BankAccount, as: "fromBank", required: false },
        { model: BankAccount, as: "toBank", required: false },
      ],
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"]],
    }),
    FundTransfer.count({ where }),
    FundTransfer.sum("amount", { where }),
  ]);

  return {
    meta: {
      count,
      totalTransferred: Number(totalTransferred || 0),
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) =>
  FundTransfer.findOne({
    where: { Id: id },
    include: [
      { model: Book, as: "book", required: false },
      { model: BankAccount, as: "fromBank", required: false },
      { model: BankAccount, as: "toBank", required: false },
    ],
  });

const updateOneFromDB = async (id, payload) => {
  const {
    bookId,
    date,
    fromPaymentMode,
    fromBankAccount,
    fromBankName,
    toPaymentMode,
    toBankAccount,
    toBankName,
    amount,
    note,
    remarks,
    status,
  } = payload;

  return db.sequelize.transaction(async (t) => {
    const existing = await FundTransfer.findOne({
      where: { Id: id },
      transaction: t,
    });
    if (!existing) throw new ApiError(404, "Fund transfer not found");

    const finalFromMode = fromPaymentMode ?? existing.fromPaymentMode;
    const finalToMode = toPaymentMode ?? existing.toPaymentMode;
    const finalFromBank =
      fromBankAccount !== undefined ? fromBankAccount : existing.fromBankAccount;
    const finalToBank =
      toBankAccount !== undefined ? toBankAccount : existing.toBankAccount;

    if (bookId !== undefined) {
      const book = await Book.findByPk(bookId, { transaction: t });
      if (!book) throw new ApiError(404, "Book not found");
    }

    if (finalFromMode === "Bank" && finalFromBank) {
      const bank = await BankAccount.findByPk(finalFromBank, { transaction: t });
      if (!bank) throw new ApiError(404, "From bank account not found");
    }

    if (finalToMode === "Bank" && finalToBank) {
      const bank = await BankAccount.findByPk(finalToBank, { transaction: t });
      if (!bank) throw new ApiError(404, "To bank account not found");
    }

    const isSameAccount =
      finalFromMode === finalToMode &&
      (finalFromMode !== "Bank" || Number(finalFromBank) === Number(finalToBank));
    if (isSameAccount) {
      throw new ApiError(400, "From and To account cannot be the same");
    }

    const [updatedCount] = await FundTransfer.update(
      {
        bookId: bookId ?? undefined,
        date: date ? toDateOnly(date) : undefined,
        fromPaymentMode: fromPaymentMode ?? undefined,
        fromBankAccount:
          fromPaymentMode !== undefined
            ? finalFromMode === "Bank"
              ? finalFromBank
              : null
            : undefined,
        fromBankName:
          fromPaymentMode !== undefined
            ? finalFromMode === "Bank"
              ? fromBankName || ""
              : ""
            : undefined,
        toPaymentMode: toPaymentMode ?? undefined,
        toBankAccount:
          toPaymentMode !== undefined
            ? finalToMode === "Bank"
              ? finalToBank
              : null
            : undefined,
        toBankName:
          toPaymentMode !== undefined
            ? finalToMode === "Bank"
              ? toBankName || ""
              : ""
            : undefined,
        amount: amount ?? undefined,
        note: note !== undefined ? note || null : undefined,
        remarks: remarks !== undefined ? remarks || "" : undefined,
        status: status ?? undefined,
      },
      { where: { Id: id }, transaction: t },
    );

    return updatedCount;
  });
};

const deleteIdFromDB = async (id) => FundTransfer.destroy({ where: { Id: id } });

const getAllFromDBWithoutQuery = async () =>
  FundTransfer.findAll({
    include: [
      { model: Book, as: "book", required: false },
      { model: BankAccount, as: "fromBank", required: false },
      { model: BankAccount, as: "toBank", required: false },
    ],
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

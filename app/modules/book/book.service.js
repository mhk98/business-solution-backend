const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const ensureUniqueName = require("../../../shared/ensureUniqueName");
const { BookSearchableFields } = require("./book.constants");
const Book = db.book;
const CashInOut = db.cashInOut;
const FundTransfer = db.fundTransfer;

// Cash has no account id of its own (unlike Bank), so its balance is tracked
// per book by netting CashInOut's Cash-mode entries against FundTransfer legs
// that moved money into/out of Cash for that book.
const computeCashBalance = async (bookId) => {
  const [cashInOutNet, transferOut, transferIn] = await Promise.all([
    CashInOut.findOne({
      attributes: [
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
      where: { paymentMode: "Cash", bookId },
      raw: true,
    }),
    FundTransfer
      ? FundTransfer.sum("amount", { where: { bookId, fromPaymentMode: "Cash" } })
      : 0,
    FundTransfer
      ? FundTransfer.sum("amount", { where: { bookId, toPaymentMode: "Cash" } })
      : 0,
  ]);

  return Number(cashInOutNet?.net || 0) + Number(transferIn || 0) - Number(transferOut || 0);
};

// Batched version of computeCashBalance for every book at once (used by the
// Account Balance dashboard) so it doesn't run N queries for N books.
const getCashBalancesByBook = async () => {
  const [cashInOutRows, transferOutRows, transferInRows] = await Promise.all([
    CashInOut.findAll({
      attributes: [
        "bookId",
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
      where: { paymentMode: "Cash", bookId: { [Op.ne]: null } },
      group: ["bookId"],
      raw: true,
    }),
    FundTransfer.findAll({
      attributes: [
        "bookId",
        [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "totalOut"],
      ],
      where: { fromPaymentMode: "Cash" },
      group: ["bookId"],
      raw: true,
    }),
    FundTransfer.findAll({
      attributes: [
        "bookId",
        [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "totalIn"],
      ],
      where: { toPaymentMode: "Cash" },
      group: ["bookId"],
      raw: true,
    }),
  ]);

  const netByBook = new Map();
  cashInOutRows.forEach((row) => netByBook.set(row.bookId, Number(row.net || 0)));

  const outByBook = new Map();
  transferOutRows.forEach((row) =>
    outByBook.set(row.bookId, Number(row.totalOut || 0)),
  );

  const inByBook = new Map();
  transferInRows.forEach((row) =>
    inByBook.set(row.bookId, Number(row.totalIn || 0)),
  );

  const bookIds = new Set([
    ...netByBook.keys(),
    ...outByBook.keys(),
    ...inByBook.keys(),
  ]);

  const balanceByBookId = new Map();
  bookIds.forEach((bookId) => {
    balanceByBookId.set(
      bookId,
      (netByBook.get(bookId) || 0) +
        (inByBook.get(bookId) || 0) -
        (outByBook.get(bookId) || 0),
    );
  });

  return balanceByBookId;
};

const insertIntoDB = async (data) => {
  await ensureUniqueName(Book, data.name, { label: "Book" });

  const result = await Book.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  console.log(filters);

  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  // if (searchTerm && searchTerm.trim()) {
  //   andConditions.push({
  //     [Op.or]: BookSearchableFields.map((field) => ({
  //       [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
  //     })),
  //   });
  // }

  // // ✅ Exact filters (e.g. name)
  // if (Object.keys(otherFilters).length) {
  //   andConditions.push(
  //     ...Object.entries(otherFilters).map(([key, value]) => ({
  //       [key]: { [Op.eq]: value },
  //     }))
  //   );
  // }

  // Match `title` starting from the search term
  if (searchTerm) {
    andConditions.push({
      name: { [Op.like]: `${searchTerm}%` },
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      [Op.and]: Object.entries(filterData).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Book.findAll({
    where: whereConditions,
    offset: skip,
    paranoid: true,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Book.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Book.findOne({
    where: {
      Id: id,
    },
    include: [
      {
        model: CashInOut,
        required: false,
        where: {
          deletedAt: { [Op.is]: null },
        },
      },
    ],
  });

  if (!result) return result;

  const cashBalance = await computeCashBalance(id);
  const plain = result.get({ plain: true });

  return { ...plain, cashBalance };
};

const deleteIdFromDB = async (id) => {
  const result = await Book.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { name, note, status } = payload;

  await ensureUniqueName(Book, name, { excludeId: id, label: "Book" });

  const data = {
    name,
    note: status === "Approved" ? null : note,
    status: status ? status : "Pending",
  };
  const result = await Book.update(data, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Book.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const BookService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  computeCashBalance,
  getCashBalancesByBook,
};

module.exports = BookService;

const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const CashInOut = db.cashInOut;
const Category = db.category;
const Book = db.book;

const pad2 = (value) => String(value).padStart(2, "0");

const toDateOnly = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
};

// Resolves the filters into a concrete { start, end, month } date-only range.
// Falls back to the current calendar month when nothing is supplied.
const resolveMonthRange = ({ month, year, startDate, endDate } = {}) => {
  if (startDate || endDate) {
    return {
      start: startDate ? toDateOnly(startDate) : null,
      end: endDate ? toDateOnly(endDate) : null,
      month: null,
    };
  }

  let targetYear;
  let targetMonth; // 1-12

  if (month && /^\d{4}-\d{2}$/.test(String(month))) {
    const [y, m] = String(month).split("-");
    targetYear = Number(y);
    targetMonth = Number(m);
  } else {
    const now = new Date();
    targetYear = year ? Number(year) : now.getFullYear();
    targetMonth = now.getMonth() + 1;
  }

  const start = new Date(targetYear, targetMonth - 1, 1);
  const end = new Date(targetYear, targetMonth, 0);

  return {
    start: toDateOnly(start),
    end: toDateOnly(end),
    month: `${targetYear}-${pad2(targetMonth)}`,
  };
};

const buildBaseConditions = (filters, { start, end }) => {
  const { bookId, categoryId, searchTerm } = filters;
  const conditions = [{ categoryId: { [Op.ne]: null } }];

  if (start && end) {
    conditions.push({ date: { [Op.between]: [start, end] } });
  } else if (start) {
    conditions.push({ date: { [Op.gte]: start } });
  } else if (end) {
    conditions.push({ date: { [Op.lte]: end } });
  }

  if (bookId) conditions.push({ bookId: { [Op.eq]: bookId } });
  if (categoryId) conditions.push({ categoryId: { [Op.eq]: categoryId } });

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    conditions.push({
      [Op.or]: [{ category: { [Op.like]: `%${term}%` } }],
    });
  }

  return conditions;
};

const buildNameMaps = async () => {
  const [books, categories] = await Promise.all([
    Book.findAll({ attributes: ["Id", "name"], paranoid: false }),
    Category.findAll({ attributes: ["Id", "name"], paranoid: false }),
  ]);

  const bookNameById = new Map(books.map((book) => [book.Id, book.name]));
  const categoryNameById = new Map(
    categories.map((category) => [category.Id, category.name]),
  );

  return { bookNameById, categoryNameById };
};

const sumAttributes = [
  [
    db.Sequelize.fn(
      "SUM",
      db.Sequelize.literal(
        "CASE WHEN paymentStatus = 'CashIn' THEN amount ELSE 0 END",
      ),
    ),
    "totalCredit",
  ],
  [
    db.Sequelize.fn(
      "SUM",
      db.Sequelize.literal(
        "CASE WHEN paymentStatus = 'CashOut' THEN amount ELSE 0 END",
      ),
    ),
    "totalDebit",
  ],
];

// Monthly Reporting Book table: one row per book + category for the
// resolved month, with credit/debit totals summed from CashInOut.
const getMonthlySummary = async (filters, options) => {
  // maxLimit raised so the report export (Book x Category rows for a whole
  // period) can pull the full data set in one request, not just a page.
  const { page, limit, skip } = paginationHelpers.calculatePagination(options, {
    maxLimit: 5000,
  });
  const { start, end, month } = resolveMonthRange(filters);
  const conditions = buildBaseConditions(filters, { start, end });
  const where = { [Op.and]: conditions };

  const [rawRows, { bookNameById, categoryNameById }] = await Promise.all([
    CashInOut.findAll({
      attributes: ["bookId", "categoryId", ...sumAttributes],
      where,
      group: ["bookId", "categoryId"],
      raw: true,
    }),
    buildNameMaps(),
  ]);

  const rows = rawRows
    .map((row) => {
      const totalCredit = Number(row.totalCredit || 0);
      const totalDebit = Number(row.totalDebit || 0);

      return {
        month,
        bookId: row.bookId,
        bookName: bookNameById.get(row.bookId) || null,
        categoryId: row.categoryId,
        categoryName: categoryNameById.get(row.categoryId) || null,
        totalCredit,
        totalDebit,
        netBalance: totalCredit - totalDebit,
      };
    })
    .sort((a, b) => {
      const categoryCompare = String(a.categoryName || "").localeCompare(
        String(b.categoryName || ""),
      );
      if (categoryCompare !== 0) return categoryCompare;
      return String(a.bookName || "").localeCompare(String(b.bookName || ""));
    });

  const totalCredit = rows.reduce((sum, row) => sum + row.totalCredit, 0);
  const totalDebit = rows.reduce((sum, row) => sum + row.totalDebit, 0);

  return {
    meta: {
      count: rows.length,
      page,
      limit,
      month,
      startDate: start,
      endDate: end,
      totalCredit,
      totalDebit,
      netBalance: totalCredit - totalDebit,
    },
    data: rows.slice(skip, skip + limit),
  };
};

// Drill-down list: every CashInOut transaction for a given month + category
// (optionally narrowed to a single book), as opened from a summary row.
const getMonthlyTransactions = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { categoryId, bookId } = filters;

  if (!categoryId) {
    throw new ApiError(400, "categoryId is required");
  }

  const { start, end, month } = resolveMonthRange(filters);
  const conditions = buildBaseConditions(filters, { start, end });
  const where = { [Op.and]: conditions };

  const [data, count, totalCreditRaw, totalDebitRaw, category, book] =
    await Promise.all([
      CashInOut.findAll({
        where,
        include: [{ model: Category, as: "categoryInfo", required: false }],
        offset: skip,
        limit,
        paranoid: true,
        order:
          options.sortBy && options.sortOrder
            ? [[options.sortBy, options.sortOrder.toUpperCase()]]
            : [["date", "DESC"]],
      }),
      CashInOut.count({ where }),
      CashInOut.sum("amount", {
        where: { [Op.and]: [...conditions, { paymentStatus: "CashIn" }] },
      }),
      CashInOut.sum("amount", {
        where: { [Op.and]: [...conditions, { paymentStatus: "CashOut" }] },
      }),
      Category.findByPk(categoryId, { paranoid: false }),
      bookId ? Book.findByPk(bookId, { paranoid: false }) : null,
    ]);

  const totalCredit = Number(totalCreditRaw || 0);
  const totalDebit = Number(totalDebitRaw || 0);

  return {
    meta: {
      count,
      page,
      limit,
      month,
      startDate: start,
      endDate: end,
      bookId: bookId || null,
      bookName: book ? book.name : null,
      categoryId: Number(categoryId),
      categoryName: category ? category.name : null,
      totalCredit,
      totalDebit,
      netBalance: totalCredit - totalDebit,
    },
    data,
  };
};

// Full, unpaginated Credit + Debit ledger for a single book over the
// resolved period — used to print/export a per-book monthly statement.
const getBookStatement = async (filters) => {
  const { bookId } = filters;

  if (!bookId) {
    throw new ApiError(400, "bookId is required");
  }

  const { start, end } = resolveMonthRange(filters);
  const conditions = buildBaseConditions(filters, { start, end });
  const where = { [Op.and]: conditions };

  const [data, totalCreditRaw, totalDebitRaw, book] = await Promise.all([
    CashInOut.findAll({
      where,
      include: [{ model: Category, as: "categoryInfo", required: false }],
      paranoid: true,
      order: [
        ["date", "ASC"],
        ["Id", "ASC"],
      ],
    }),
    CashInOut.sum("amount", {
      where: { [Op.and]: [...conditions, { paymentStatus: "CashIn" }] },
    }),
    CashInOut.sum("amount", {
      where: { [Op.and]: [...conditions, { paymentStatus: "CashOut" }] },
    }),
    Book.findByPk(bookId, { paranoid: false }),
  ]);

  const totalCredit = Number(totalCreditRaw || 0);
  const totalDebit = Number(totalDebitRaw || 0);

  return {
    meta: {
      count: data.length,
      startDate: start,
      endDate: end,
      bookId: Number(bookId),
      bookName: book ? book.name : null,
      totalCredit,
      totalDebit,
      netBalance: totalCredit - totalDebit,
    },
    data,
  };
};

module.exports = {
  getMonthlySummary,
  getMonthlyTransactions,
  getBookStatement,
};

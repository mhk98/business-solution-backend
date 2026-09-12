const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const {
  getInventoryStockReport,
} = require("../inventoryOverview/inventoryOverview.service");

const CashInOut = db.cashInOut;
const Category = db.category;
const Book = db.book;
const PettyCash = db.pettyCash;

const pad2 = (value) => String(value).padStart(2, "0");

// Sentinel "beginning of time" used as the inventory ledger's `from` when the
// statement is unfiltered ("All Data") so opening stock resolves to 0.
const ALL_TIME_FROM = "1970-01-01";

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
    // Books: live only — a deleted book must not resurface as a "book" in the
    // Monthly Reporting table or the "All Books" statement, even if stray
    // CashInOut rows still point at it. Categories stay paranoid:false so a
    // legit transaction keeps its historical category label after the category
    // is deleted.
    Book.findAll({ attributes: ["Id", "name"] }),
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

  const [rawRows, { bookNameById, categoryNameById }, inventoryStockReport] =
    await Promise.all([
      CashInOut.findAll({
        attributes: ["bookId", "categoryId", ...sumAttributes],
        where,
        group: ["bookId", "categoryId"],
        raw: true,
      }),
      buildNameMaps(),
      getInventoryStockReport({ from: start, to: end }),
    ]);

  const rows = rawRows
    // Drop CashInOut rows whose book has been deleted (or is missing) so the
    // report and its credit/debit totals only ever reflect live books.
    .filter((row) => bookNameById.has(row.bookId))
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
    inventoryStockReport,
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

  // "All Data" (no explicit month/date filter) means the whole history: no
  // date bounds and no opening balance. An explicit filter is the only thing
  // that carves the ledger into opening / period / ending.
  const hasExplicitRange =
    Boolean(filters.startDate) ||
    Boolean(filters.endDate) ||
    Boolean(filters.month) ||
    Boolean(filters.year);
  const resolvedRange = resolveMonthRange(filters);
  const start = hasExplicitRange ? resolvedRange.start : null;
  const end = hasExplicitRange ? resolvedRange.end : null;

  // The inventory stock section's backend (computeStockMovementLedgerReport)
  // requires a concrete [from, to]. With an explicit filter it uses that
  // window (opening stock = balance before `from`). With "All Data" it must
  // match the cash ledger's opening-balance behaviour — all-time, opening = 0 —
  // so the window starts at the epoch instead of the current month.
  const inventoryFrom =
    (hasExplicitRange ? resolvedRange.start : null) || ALL_TIME_FROM;
  const inventoryTo = resolvedRange.end || toDateOnly(new Date());

  const conditions = buildBaseConditions(filters, { start, end });
  const where = { [Op.and]: conditions };

  // Opening balance = everything for this book (and matching filters) dated
  // strictly before the statement's start date, grouped per category.
  // `currentConditions` is the same but date-independent — the live figure
  // that ignores the filter (used for the payment-mode "বর্তমান ব্যালেন্স").
  const currentConditions = buildBaseConditions(filters, {
    start: null,
    end: null,
  });
  const openingConditions = buildBaseConditions(filters, {
    start: null,
    end: null,
  });
  if (start) openingConditions.push({ date: { [Op.lt]: start } });

  // Assets Purchase / Sale / Damage follow the ledger's date filter; Assets
  // Stock is a live snapshot (no date column).
  const assetsDateWhere =
    start && end
      ? { date: { [Op.between]: [start, end] } }
      : start
        ? { date: { [Op.gte]: start } }
        : end
          ? { date: { [Op.lte]: end } }
          : {};

  // Payment-mode balance section (between Profit/Loss and Assets): net cash
  // (CashIn − CashOut) per paymentMode, scoped like the credit/debit ledger.
  const cashMovementWhere = { paymentStatus: { [Op.in]: ["CashIn", "CashOut"] } };
  const paymentModeAttributes = [
    "paymentMode",
    "paymentStatus",
    [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
  ];

  // Petty Cash for this book/period — no categoryId requirement (matches
  // pettyCash.service.js's own Total CashIn/Total CashOut widget, which
  // never filters by category unless the user explicitly picks one).
  const pettyCashWhere = { ...assetsDateWhere, bookId: { [Op.eq]: bookId } };

  const [
    data,
    totalCreditRaw,
    totalDebitRaw,
    pettyCashCreditRaw,
    pettyCashDebitRaw,
    book,
    inventoryStockReport,
    openingRows,
    assetsStockRows,
    assetsPurchaseRows,
    assetsSaleRows,
    assetsDamageRows,
    paymentModePeriodRows,
    paymentModeOpeningRows,
    paymentModeCurrentRows,
  ] = await Promise.all([
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
    PettyCash
      ? PettyCash.sum("amount", {
          where: { ...pettyCashWhere, paymentStatus: "CashIn" },
        })
      : Promise.resolve(0),
    PettyCash
      ? PettyCash.sum("amount", {
          where: { ...pettyCashWhere, paymentStatus: "CashOut" },
        })
      : Promise.resolve(0),
    Book.findByPk(bookId, { paranoid: false }),
    getInventoryStockReport({ from: inventoryFrom, to: inventoryTo }),
    start
      ? CashInOut.findAll({
          where: { [Op.and]: openingConditions },
          attributes: [
            "categoryId",
            "paymentStatus",
            [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
          ],
          group: ["categoryId", "paymentStatus"],
          paranoid: true,
          raw: true,
        })
      : Promise.resolve([]),
    db.assetsStock.findAll({
      attributes: ["name", "quantity", "price"],
      paranoid: true,
      raw: true,
      order: [["name", "ASC"]],
    }),
    db.assetsPurchase.findAll({
      where: assetsDateWhere,
      attributes: ["name", "quantity", "price", "date", "total"],
      paranoid: true,
      raw: true,
      order: [["date", "ASC"], ["Id", "ASC"]],
    }),
    db.assetsSale.findAll({
      where: assetsDateWhere,
      attributes: ["name", "quantity", "price", "date", "total"],
      paranoid: true,
      raw: true,
      order: [["date", "ASC"], ["Id", "ASC"]],
    }),
    db.assetsDamage.findAll({
      where: assetsDateWhere,
      attributes: ["name", "quantity", "price", "date", "total"],
      paranoid: true,
      raw: true,
      order: [["date", "ASC"], ["Id", "ASC"]],
    }),
    CashInOut.findAll({
      where: { [Op.and]: [...conditions, cashMovementWhere] },
      attributes: paymentModeAttributes,
      group: ["paymentMode", "paymentStatus"],
      paranoid: true,
      raw: true,
    }),
    start
      ? CashInOut.findAll({
          where: { [Op.and]: [...openingConditions, cashMovementWhere] },
          attributes: paymentModeAttributes,
          group: ["paymentMode", "paymentStatus"],
          paranoid: true,
          raw: true,
        })
      : Promise.resolve([]),
    CashInOut.findAll({
      where: { [Op.and]: [...currentConditions, cashMovementWhere] },
      attributes: paymentModeAttributes,
      group: ["paymentMode", "paymentStatus"],
      paranoid: true,
      raw: true,
    }),
  ]);

  const totalCredit = Number(totalCreditRaw || 0);
  const totalDebit = Number(totalDebitRaw || 0);

  const pettyCashTotalCredit = Number(pettyCashCreditRaw || 0);
  const pettyCashTotalDebit = Number(pettyCashDebitRaw || 0);
  const pettyCashNetBalance = pettyCashTotalCredit - pettyCashTotalDebit;

  const toNum = (value) => Number(value || 0);
  const buildAssetGroup = (rows, { withDate }) => {
    const entries = rows.map((row) => {
      const quantity = toNum(row.quantity);
      const price = toNum(row.price);
      const lineTotal =
        row.total !== undefined && row.total !== null
          ? toNum(row.total)
          : quantity * price;
      return {
        name: row.name || "-",
        date: withDate ? row.date || null : null,
        quantity,
        price,
        total: lineTotal,
      };
    });
    return {
      data: entries,
      totalQuantity: entries.reduce((sum, row) => sum + row.quantity, 0),
      total: entries.reduce((sum, row) => sum + row.total, 0),
    };
  };

  const assetsSummary = {
    stock: buildAssetGroup(assetsStockRows, { withDate: false }),
    purchase: buildAssetGroup(assetsPurchaseRows, { withDate: true }),
    sale: buildAssetGroup(assetsSaleRows, { withDate: true }),
    damage: buildAssetGroup(assetsDamageRows, { withDate: true }),
  };

  // Net cash (CashIn − CashOut) per payment mode: opening (< start), the
  // period movement (ব্যালেন্স পার্থক্য) and ending (opening + period).
  const paymentModeMap = {};
  const applyPaymentModeRows = (rows, key) => {
    rows.forEach((row) => {
      const mode = (row.paymentMode && String(row.paymentMode).trim()) || "উল্লেখ নেই";
      const amount = Number(row.total || 0);
      const signed =
        String(row.paymentStatus || "").toLowerCase() === "cashin"
          ? amount
          : -amount;
      if (!paymentModeMap[mode]) {
        paymentModeMap[mode] = { opening: 0, period: 0, current: 0 };
      }
      paymentModeMap[mode][key] += signed;
    });
  };
  applyPaymentModeRows(paymentModeOpeningRows, "opening");
  applyPaymentModeRows(paymentModePeriodRows, "period");
  applyPaymentModeRows(paymentModeCurrentRows, "current");

  const paymentModeSummary = Object.entries(paymentModeMap)
    .map(([mode, value]) => ({
      mode,
      opening: value.opening,
      diff: value.period,
      ending: value.opening + value.period,
      current: value.current,
    }))
    .sort((a, b) => b.current - a.current);

  const openingByCategory = {};
  let openingTotalCredit = 0;
  let openingTotalDebit = 0;
  openingRows.forEach((row) => {
    const key = String(row.categoryId);
    const amount = Number(row.total || 0);
    const isCredit = String(row.paymentStatus || "").toLowerCase() === "cashin";
    if (!openingByCategory[key]) openingByCategory[key] = { credit: 0, debit: 0 };
    if (isCredit) {
      openingByCategory[key].credit += amount;
      openingTotalCredit += amount;
    } else {
      openingByCategory[key].debit += amount;
      openingTotalDebit += amount;
    }
  });

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
      pettyCashTotalCredit,
      pettyCashTotalDebit,
      pettyCashNetBalance,
      netBalanceWithPettyCash: totalCredit - totalDebit + pettyCashNetBalance,
      openingByCategory,
      openingTotalCredit,
      openingTotalDebit,
      openingNetBalance: openingTotalCredit - openingTotalDebit,
      assetsSummary,
      paymentModeSummary,
    },
    inventoryStockReport,
    data,
  };
};

module.exports = {
  getMonthlySummary,
  getMonthlyTransactions,
  getBookStatement,
};

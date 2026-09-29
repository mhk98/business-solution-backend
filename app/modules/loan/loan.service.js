const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const ApiError = require("../../../error/ApiError");
const { summarizeLoan, sumLoanBalances } = require("./loan.accounting");
const validateLoanType = (value) => {
  if (!["BORROWED", "LENT"].includes(value)) throw new ApiError(400, "loanType must be BORROWED or LENT");
  return value;
};
const Loan = db.loan;
const LenderHistory = db.lenderHistory;

const normalizeAmount = (value) => Number(value || 0);

const buildDateCondition = ({ startDate, endDate } = {}) => {
  if (startDate && endDate) return { [Op.between]: [startDate, endDate] };
  if (startDate) return { [Op.gte]: startDate };
  if (endDate) return { [Op.lte]: endDate };
  return null;
};

// Each Loan is a two-way running account with one party: the company may both
// borrow from and lend to the same party. Balance = CashIn - CashOut;
// positive -> company owes the party (দেনা / payable),
// negative -> party owes the company (পাওনা / receivable).
// Balances are cumulative (opening as of < startDate, closing as of <= endDate);
// the date range only scopes the period movement columns.
const ledgerSplit = (balance) => ({
  payable: Math.max(balance, 0),
  receivable: Math.max(-balance, 0),
});

const addBalancesToLoans = async (loans, filters = {}) => {
  const plainLoans = loans.map((loan) =>
    loan.get ? loan.get({ plain: true }) : loan,
  );
  const loanIds = plainLoans.map((loan) => loan.Id).filter(Boolean);

  if (!loanIds.length) return plainLoans;

  const { startDate, endDate } = filters;
  const where = { loanId: { [Op.in]: loanIds } };
  if (endDate) where.date = { [Op.lte]: endDate };

  const beforeStart = startDate
    ? `date < ${db.sequelize.escape(startDate)}`
    : "1 = 0";
  const sumWhen = (condition) =>
    db.Sequelize.fn(
      "SUM",
      db.Sequelize.literal(`CASE WHEN ${condition} THEN amount ELSE 0 END`),
    );

  const rows = await LenderHistory.findAll({
    attributes: [
      "loanId",
      [sumWhen(`paymentStatus = 'CashIn' AND ${beforeStart}`), "openingCashIn"],
      [sumWhen(`paymentStatus = 'CashOut' AND ${beforeStart}`), "openingCashOut"],
      [sumWhen(`paymentStatus = 'CashIn' AND NOT (${beforeStart})`), "periodCashIn"],
      [sumWhen(`paymentStatus = 'CashOut' AND NOT (${beforeStart})`), "periodCashOut"],
      [db.Sequelize.fn("MAX", db.Sequelize.col("date")), "lastDate"],
    ],
    where,
    group: ["loanId"],
    raw: true,
  });

  const balanceMap = new Map(rows.map((row) => [Number(row.loanId), row]));
  return plainLoans.map((loan) => {
    const row = balanceMap.get(Number(loan.Id)) || {};
    const periodCashIn = normalizeAmount(row.periodCashIn);
    const periodCashOut = normalizeAmount(row.periodCashOut);
    const openingBalance =
      normalizeAmount(row.openingCashIn) - normalizeAmount(row.openingCashOut);
    const closingBalance = openingBalance + periodCashIn - periodCashOut;
    return {
      ...loan,
      ...summarizeLoan(loan.loanType, periodCashIn, periodCashOut),
      periodCashIn,
      periodCashOut,
      openingBalance,
      closingBalance,
      ...ledgerSplit(closingBalance),
      lastDate: row.lastDate || null,
    };
  });
};

const sumLedgerTotals = (rows) => {
  const sum = (key) => rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
  return {
    periodCashIn: sum("periodCashIn"),
    periodCashOut: sum("periodCashOut"),
    totalPayable: sum("payable"),
    totalReceivable: sum("receivable"),
    payableCount: rows.filter((row) => row.closingBalance > 0).length,
    receivableCount: rows.filter((row) => row.closingBalance < 0).length,
  };
};

// balanceStatus: "payable" | "receivable" | "open" (either side) | "settled"
const matchesBalanceStatus = (row, balanceStatus) => {
  if (balanceStatus === "payable") return row.closingBalance > 0;
  if (balanceStatus === "receivable") return row.closingBalance < 0;
  if (balanceStatus === "open") return row.closingBalance !== 0;
  if (balanceStatus === "settled") return row.closingBalance === 0;
  return true;
};

const insertIntoDB = async (payload) => Loan.create({
  name: String(payload.name || "").trim(),
  loanType: validateLoanType(payload.loanType ?? "BORROWED"),
  note: payload.note || null,
  status: payload.status || "Active",
});

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, balanceStatus, ...filterData } =
    filters;
  const andConditions = [];
  const balanceFilters = { startDate, endDate };

  if (searchTerm && String(searchTerm).trim()) {
    andConditions.push({
      name: { [Op.like]: `${String(searchTerm).trim()}%` },
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

  andConditions.push({ deletedAt: { [Op.is]: null } });
  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  // Balance filtering needs every account's balance, so paginate in memory.
  const allRows = await Loan.findAll({
    where,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });
  const allLoansWithBalances = await addBalancesToLoans(
    allRows,
    balanceFilters,
  );
  // Totals cover every account so the summary cards stay stable across tabs.
  const totals = sumLedgerTotals(allLoansWithBalances);
  const filtered = allLoansWithBalances.filter((row) =>
    matchesBalanceStatus(row, balanceStatus),
  );

  return {
    meta: {
      count: filtered.length,
      page,
      limit,
      ...sumLoanBalances(allLoansWithBalances),
      ...totals,
      netPosition: totals.totalReceivable - totals.totalPayable,
    },
    data: filtered.slice(skip, skip + limit),
  };
};

const getDataById = async (id) => Loan.findOne({ where: { Id: id } });

const updateOneFromDB = async (id, payload) => db.sequelize.transaction(async (transaction) => {
  const loan = await Loan.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!loan) throw new ApiError(404, "Loan not found");
  if (payload.loanType !== undefined) {
    validateLoanType(payload.loanType);
    if (payload.loanType !== loan.loanType && await LenderHistory.count({ where: { loanId: id }, transaction, paranoid: false })) {
      throw new ApiError(400, "Loan type cannot change after transactions. Create a separate loan account.");
    }
  }
  const changes = {};
  for (const key of ["name", "note", "status", "loanType"]) {
    if (payload[key] !== undefined) changes[key] = key === "name" ? String(payload[key]).trim() : payload[key];
  }
  await loan.update(changes, { transaction });
  return [1];
});

const deleteIdFromDB = async (id) => db.sequelize.transaction(async (transaction) => {
  const loan = await Loan.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!loan) throw new ApiError(404, "Loan not found");
  if (await LenderHistory.count({ where: { loanId: id }, transaction })) {
    throw new ApiError(400, "A loan with transactions cannot be deleted. Mark it Inactive instead.");
  }
  await loan.destroy({ transaction });
  return 1;
});

const getAllFromDBWithoutQuery = async () => {
  const rows = await Loan.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return addBalancesToLoans(rows);
};

// Lenders the company has overpaid — i.e. lenders who still owe the company
// money back (repaid more than was borrowed). For the shared "All Books" /
// dashboard statement report. `advance` is the closing (through the selected end date) figure;
// `openingBalance` / `endingBalance` are the same as of `< from` and `<= to`.
const getLenderReceivableReport = async ({ from, to } = {}) => {
  const receivableByLoan = async (dateWhere) => {
    const rows = await LenderHistory.findAll({
      attributes: [
        "loanId",
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(
              "CASE WHEN paymentStatus = 'CashIn' THEN amount ELSE 0 END",
            ),
          ),
          "totalLoanTaken",
        ],
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(
              "CASE WHEN paymentStatus = 'CashOut' THEN amount ELSE 0 END",
            ),
          ),
          "totalLoanPaid",
        ],
      ],
      where: { ...dateWhere, loanId: { [Op.ne]: null } },
      group: ["loanId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.loanId) return;
      const receivable = Math.max(
        normalizeAmount(row.totalLoanPaid) - normalizeAmount(row.totalLoanTaken),
        0,
      );
      map.set(row.loanId, receivable);
    });
    return map;
  };

  const [openingMap, endingMap] = await Promise.all([
    from
      ? receivableByLoan({ date: { [Op.lt]: from } })
      : Promise.resolve(new Map()),
    to ? receivableByLoan({ date: { [Op.lte]: to } }) : receivableByLoan({}),
  ]);

  const loanIds = [
    ...new Set([
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const loans = loanIds.length
    ? await Loan.findAll({
        where: { Id: { [Op.in]: loanIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(loans.map((loan) => [loan.Id, loan.name]));

  const data = loanIds
    .map((loanId) => ({
      loanId,
      name: nameById.get(loanId) || null,
      advance: endingMap.get(loanId) || 0,
      openingBalance: openingMap.get(loanId) || 0,
      endingBalance: endingMap.get(loanId) || 0,
    }))
    // Skip deleted/unknown lenders — only live lenders the company has overpaid
    // (at closing or during the period) belong here.
    .filter(
      (row) =>
        row.name &&
        (row.advance > 0 || row.openingBalance > 0 || row.endingBalance > 0),
    )
    .sort((a, b) => b.advance - a.advance);

  const sum = (key) => data.reduce((acc, row) => acc + row[key], 0);

  return {
    meta: {
      from: from || null,
      to: to || null,
      count: data.length,
      totalAdvance: sum("advance"),
      totalOpeningBalance: sum("openingBalance"),
      totalEndingBalance: sum("endingBalance"),
    },
    data,
  };
};

// Positive "কত পাবে" in the Lender table means the company still owes money
// to that lender (netBalance = totalLoanTaken - totalLoanPaid). Shown in the
// book report as "কোম্পানির কাছে পাবে (লেন্ডার)". `due` is the closing
// (through the selected end date) figure; `openingBalance` / `endingBalance` are the same as of
// `< from` and `<= to` so the PDF can show the period movement.
const getLenderPayableReport = async ({ from, to } = {}) => {
  const dueByLoan = async (dateWhere) => {
    const rows = await LenderHistory.findAll({
      attributes: [
        "loanId",
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(
              "CASE WHEN paymentStatus = 'CashIn' THEN amount ELSE 0 END",
            ),
          ),
          "totalLoanTaken",
        ],
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(
              "CASE WHEN paymentStatus = 'CashOut' THEN amount ELSE 0 END",
            ),
          ),
          "totalLoanPaid",
        ],
      ],
      where: { ...dateWhere, loanId: { [Op.ne]: null } },
      group: ["loanId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.loanId) return;
      const due = Math.max(
        normalizeAmount(row.totalLoanTaken) - normalizeAmount(row.totalLoanPaid),
        0,
      );
      map.set(row.loanId, due);
    });
    return map;
  };

  const [openingMap, endingMap] = await Promise.all([
    from ? dueByLoan({ date: { [Op.lt]: from } }) : Promise.resolve(new Map()),
    to ? dueByLoan({ date: { [Op.lte]: to } }) : dueByLoan({}),
  ]);

  const loanIds = [
    ...new Set([
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const loans = loanIds.length
    ? await Loan.findAll({
        where: { Id: { [Op.in]: loanIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(loans.map((loan) => [loan.Id, loan.name]));

  const data = loanIds
    .map((loanId) => ({
      loanId,
      name: nameById.get(loanId) || null,
      due: endingMap.get(loanId) || 0,
      openingBalance: openingMap.get(loanId) || 0,
      endingBalance: endingMap.get(loanId) || 0,
    }))
    // Skip deleted/unknown lenders — only live lenders with an outstanding due
    // (at closing or during the period) belong here.
    .filter(
      (row) =>
        row.name &&
        (row.due > 0 || row.openingBalance > 0 || row.endingBalance > 0),
    )
    .sort((a, b) => b.due - a.due);

  const sum = (key) => data.reduce((acc, row) => acc + row[key], 0);

  return {
    meta: {
      from: from || null,
      to: to || null,
      count: data.length,
      totalDue: sum("due"),
      totalOpeningBalance: sum("openingBalance"),
      totalEndingBalance: sum("endingBalance"),
    },
    data,
  };
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getLenderReceivableReport,
  getLenderPayableReport,
};

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const Loan = db.loan;
const CashInOut = db.cashInOut;

const normalizeAmount = (value) => Number(value || 0);

const buildDateCondition = ({ startDate, endDate } = {}) => {
  if (startDate && endDate) return { [Op.between]: [startDate, endDate] };
  if (startDate) return { [Op.gte]: startDate };
  if (endDate) return { [Op.lte]: endDate };
  return null;
};

const addBalancesToLoans = async (loans, filters = {}) => {
  const plainLoans = loans.map((loan) =>
    loan.get ? loan.get({ plain: true }) : loan,
  );
  const loanIds = plainLoans.map((loan) => loan.Id).filter(Boolean);

  if (!loanIds.length) return plainLoans;

  const dateCondition = buildDateCondition(filters);
  const where = {
    loanId: { [Op.in]: loanIds },
  };

  if (dateCondition) where.date = dateCondition;

  const rows = await CashInOut.findAll({
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
      [db.Sequelize.fn("MAX", db.Sequelize.col("date")), "lastDate"],
    ],
    where,
    group: ["loanId"],
    raw: true,
  });

  const balanceMap = rows.reduce((acc, row) => {
    const totalLoanTaken = normalizeAmount(row.totalLoanTaken);
    const totalLoanPaid = normalizeAmount(row.totalLoanPaid);
    acc[row.loanId] = {
      totalLoanTaken,
      totalLoanPaid,
      totalLoanGiven: totalLoanPaid,
      netBalance: totalLoanTaken - totalLoanPaid,
      lastDate: row.lastDate,
    };
    return acc;
  }, {});

  return plainLoans.map((loan) => ({
    ...loan,
    totalLoanTaken: balanceMap[loan.Id]?.totalLoanTaken || 0,
    totalLoanPaid: balanceMap[loan.Id]?.totalLoanPaid || 0,
    totalLoanGiven: balanceMap[loan.Id]?.totalLoanGiven || 0,
    netBalance: balanceMap[loan.Id]?.netBalance || 0,
    lastDate: balanceMap[loan.Id]?.lastDate || null,
  }));
};

const insertIntoDB = async (payload) =>
  Loan.create({
    name: String(payload.name || "").trim(),
    note: payload.note || null,
    status: payload.status || "Active",
  });

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...filterData } = filters;
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

  const [rows, count, allRows] = await Promise.all([
    Loan.findAll({
      where,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    Loan.count({ where }),
    Loan.findAll({ where, paranoid: true }),
  ]);
  const allLoansWithBalances = await addBalancesToLoans(
    allRows,
    balanceFilters,
  );
  const totalLoanTaken = allLoansWithBalances.reduce(
    (sum, loan) => sum + normalizeAmount(loan.totalLoanTaken),
    0,
  );
  const totalLoanPaid = allLoansWithBalances.reduce(
    (sum, loan) => sum + normalizeAmount(loan.totalLoanPaid),
    0,
  );

  return {
    meta: {
      count,
      page,
      limit,
      totalLoanTaken,
      totalLoanPaid,
      totalLoanGiven: totalLoanPaid,
      netBalance: totalLoanTaken - totalLoanPaid,
    },
    data: await addBalancesToLoans(rows, balanceFilters),
  };
};

const getDataById = async (id) => Loan.findOne({ where: { Id: id } });

const updateOneFromDB = async (id, payload) =>
  Loan.update(
    {
      name: String(payload.name || "").trim(),
      note: payload.note || null,
      status: payload.status || "Active",
    },
    { where: { Id: id } },
  );

const deleteIdFromDB = async (id) => Loan.destroy({ where: { Id: id } });

const getAllFromDBWithoutQuery = async () => {
  const rows = await Loan.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return addBalancesToLoans(rows);
};

// Lenders the company has overpaid as of `to` — i.e. lenders who still owe
// the company money back (repaid more than was borrowed). Point-in-time
// snapshot filtered to CashInOut rows on or before `to`, for the shared
// "All Books" / dashboard statement report.
const getLenderReceivableReport = async ({ to } = {}) => {
  const dateWhere = to ? { date: { [Op.lte]: to } } : {};

  const balanceRows = await CashInOut.findAll({
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

  const loanIds = balanceRows.map((row) => row.loanId).filter(Boolean);
  const loans = loanIds.length
    ? await Loan.findAll({
        where: { Id: { [Op.in]: loanIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(loans.map((loan) => [loan.Id, loan.name]));

  const data = balanceRows
    .map((row) => {
      const totalLoanTaken = normalizeAmount(row.totalLoanTaken);
      const totalLoanPaid = normalizeAmount(row.totalLoanPaid);
      const receivable = Math.max(totalLoanPaid - totalLoanTaken, 0);

      return {
        loanId: row.loanId,
        name: nameById.get(row.loanId) || null,
        advance: receivable,
      };
    })
    // Skip deleted/unknown lenders — only live lenders the company has overpaid
    // belong here.
    .filter((row) => row.name && row.advance > 0)
    .sort((a, b) => b.advance - a.advance);

  const totalAdvance = data.reduce((sum, row) => sum + row.advance, 0);

  return {
    meta: { to: to || null, count: data.length, totalAdvance },
    data,
  };
};

// Positive "কত পাবে" in the Lender table means the company still owes money
// to that lender (netBalance = totalLoanTaken - totalLoanPaid). This is shown
// separately in the book report as "কোম্পানির কাছে পাবে (লেন্ডার)".
const getLenderPayableReport = async () => {
  const balanceRows = await CashInOut.findAll({
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
    where: { loanId: { [Op.ne]: null } },
    group: ["loanId"],
    raw: true,
  });

  const loanIds = balanceRows.map((row) => row.loanId).filter(Boolean);
  const loans = loanIds.length
    ? await Loan.findAll({
        where: { Id: { [Op.in]: loanIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(loans.map((loan) => [loan.Id, loan.name]));

  const data = balanceRows
    .map((row) => {
      const totalLoanTaken = normalizeAmount(row.totalLoanTaken);
      const totalLoanPaid = normalizeAmount(row.totalLoanPaid);
      const due = Math.max(totalLoanTaken - totalLoanPaid, 0);

      return {
        loanId: row.loanId,
        name: nameById.get(row.loanId) || null,
        due,
      };
    })
    // Skip deleted/unknown lenders — only live lenders with an outstanding due
    // belong here.
    .filter((row) => row.name && row.due > 0)
    .sort((a, b) => b.due - a.due);

  const totalDue = data.reduce((sum, row) => sum + row.due, 0);

  return {
    meta: { count: data.length, totalDue },
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

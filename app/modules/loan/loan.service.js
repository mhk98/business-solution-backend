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
    category: { [Op.like]: "loan" },
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

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

// app/modules/overview/overview.service.js

const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const MarketingExpense = db.marketingExpense;

// ✅ helper: safe number
const n = (v) => Number(v || 0);

// ✅ helper: date range where builder
const buildDateWhere = (from, to) => {
  if (!from && !to) return {};

  // যদি একটাই পাঠায়, error দিবো (optional)
  if (!from || !to) {
    throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
  }

  // server timezone based date boundary
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  return {
    date: { [Op.between]: [start, end] },
  };
};

const sumField = async (Model, field, where = {}) => {
  if (!Model) return 0;
  const total = await Model.sum(field, { where });
  return n(total);
};

const getOverviewSummaryFromDB = async (filters) => {
  const { from, to } = filters;
  const dateWhere = buildDateWhere(from, to);

  // ✅ Parallel queries (fast)
  const [totalCashInAmount, totalCashOutAmount] = await Promise.all([
    // Cash In/Out (same table, different status)
    sumField(MarketingExpense, "amount", {
      ...dateWhere,
      paymentStatus: "CashIn",
    }),
    sumField(MarketingExpense, "amount", {
      ...dateWhere,
      paymentStatus: "CashOut",
    }),
  ]);

  return {
    // filters echo (optional)
    from: from || null,
    to: to || null,

    // Cash
    totalCashInAmount,
    totalCashOutAmount,
  };
};

const marketingExpenseOverview = {
  getOverviewSummaryFromDB,
};

module.exports = marketingExpenseOverview;

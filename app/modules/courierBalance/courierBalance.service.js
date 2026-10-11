const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { CourierBalanceSearchableFields } = require("./courierBalance.constants");

const CourierBalance = db.courierBalance;

const normalizePayload = (payload = {}) => {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  if (!payload.date) throw new ApiError(400, "Date is required");

  const note = String(payload.note || "").trim();
  return { date: payload.date, amount, note: note || null };
};

const insertIntoDB = async (payload = {}) =>
  CourierBalance.create(normalizePayload(payload));

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: CourierBalanceSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (startDate || endDate) {
    andConditions.push({
      date: {
        ...(startDate ? { [Op.gte]: startDate } : {}),
        ...(endDate ? { [Op.lte]: endDate } : {}),
      },
    });
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  const [data, count, totalAmount] = await Promise.all([
    CourierBalance.findAll({
      where,
      offset: skip,
      limit,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"], ["createdAt", "DESC"]],
    }),
    CourierBalance.count({ where }),
    CourierBalance.sum("amount", { where }),
  ]);

  return {
    meta: { count, totalAmount: Number(totalAmount || 0), page, limit },
    data,
  };
};

const getDataById = async (id) => CourierBalance.findOne({ where: { Id: id } });

const updateOneFromDB = async (id, payload = {}) => {
  const [updatedCount] = await CourierBalance.update(normalizePayload(payload), {
    where: { Id: id },
  });
  return updatedCount;
};

const deleteIdFromDB = async (id) => CourierBalance.destroy({ where: { Id: id } });

// Courier balance entries inside the report range, for the shared "All
// Books" / Monthly Reporting Book statement PDF (see inventoryOverview's
// getInventoryStockReport). `totalAmount` = sum of the entries in [from, to].
// A Courier Balance entry is a snapshot of what the courier holds on that
// date, not a movement — so the report shows the balance as of the filter's
// END date: the entries of the latest date on or before `to` (several entries
// on that date, e.g. one per courier, are added). `from` doesn't limit it —
// the last snapshot before the range is still the balance on `to`.
// `before` gives the opening balance: the latest snapshot dated strictly
// before that day (e.g. the report's start date).
const getCourierBalanceReport = async ({ from, to, before } = {}) => {
  const where = before
    ? { date: { [Op.lt]: before } }
    : to
      ? { date: { [Op.lte]: to } }
      : {};
  const latest = await CourierBalance.findOne({
    where,
    attributes: ["date"],
    order: [["date", "DESC"]],
    raw: true,
  });
  const rows = latest
    ? await CourierBalance.findAll({
        where: { date: latest.date },
        attributes: ["Id", "date", "amount", "note"],
        order: [["Id", "ASC"]],
        raw: true,
      })
    : [];
  const data = rows.map((row) => ({ ...row, amount: Number(row.amount || 0) }));

  return {
    meta: {
      from: from || null,
      to: to || null,
      balanceDate: latest?.date || null,
      count: data.length,
      totalAmount: data.reduce((sum, row) => sum + row.amount, 0),
    },
    data,
  };
};

const previousDay = (ymd) => {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

// The Book report needs courier stock and courier balance entered for the day
// before its start date (opening) and for its end date (closing). Lists what
// is missing; an empty list means the report can be generated.
const getReportCoverage = async ({ from, to } = {}) => {
  const isYmd = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  if (!isYmd(from) || !isYmd(to)) {
    throw new ApiError(400, "from and to (YYYY-MM-DD) are required");
  }
  const openingDate = previousDay(from);
  const checks = [
    { key: "courierStock", label: "কুরিয়ার স্টক", Model: db.courierProductStock },
    { key: "courierBalance", label: "কুরিয়ার ব্যালেন্স", Model: CourierBalance },
  ];
  const dates = [
    { key: "opening", date: openingDate },
    { key: "closing", date: to },
  ];
  const results = await Promise.all(
    checks.flatMap((check) =>
      dates.map(async (day) => ({
        item: check.key,
        label: check.label,
        when: day.key,
        date: day.date,
        found: (await check.Model.count({ where: { date: day.date } })) > 0,
      })),
    ),
  );
  return {
    openingDate,
    closingDate: to,
    ok: results.every((row) => row.found),
    missing: results.filter((row) => !row.found),
  };
};

module.exports = {
  getCourierBalanceReport,
  getReportCoverage,
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
};

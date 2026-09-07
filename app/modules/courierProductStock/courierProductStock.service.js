const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  CourierProductStockSearchableFields,
  CourierProductStockStatusOptions,
} = require("./courierProductStock.constants");

const CourierProductStock = db.courierProductStock;

const normalizePayload = (payload = {}) => {
  const status = String(payload.status || "").trim();
  if (!CourierProductStockStatusOptions.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  if (!payload.date) throw new ApiError(400, "Date is required");

  return {
    date: payload.date,
    status,
    amount,
  };
};

const insertIntoDB = async (payload = {}) => {
  const data = normalizePayload(payload);
  return CourierProductStock.create(data);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: CourierProductStockSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => ({ [key]: { [Op.eq]: value } })),
    );
  }

  if (startDate && endDate) {
    andConditions.push({ date: { [Op.between]: [startDate, endDate] } });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count, totalAmount] = await Promise.all([
    CourierProductStock.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"], ["createdAt", "DESC"]],
    }),
    CourierProductStock.count({ where: whereConditions }),
    CourierProductStock.sum("amount", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalAmount: totalAmount || 0, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  return CourierProductStock.findOne({ where: { Id: id } });
};

const updateOneFromDB = async (id, payload = {}) => {
  const data = normalizePayload(payload);
  const [updatedCount] = await CourierProductStock.update(data, {
    where: { Id: id },
  });
  return updatedCount;
};

const deleteIdFromDB = async (id) => {
  return CourierProductStock.destroy({ where: { Id: id } });
};

const getAllFromDBWithoutQuery = async () => {
  return CourierProductStock.findAll({
    paranoid: true,
    order: [["date", "DESC"], ["createdAt", "DESC"]],
  });
};

// Period ledger consumed by the shared "All Books" / Monthly Reporting Book
// statement PDF and the Dashboard's Print/Download Book action (see
// inventoryOverview.service.js's getInventoryStockReport).
// Summarised one row per status for the "All Books" / Monthly Reporting Book
// statement PDF: `periodAmount` = that status's total inside [from, to],
// `openingAmount` = its total dated strictly before `from`, `endingAmount` =
// the two combined.
const getCourierProductStockReport = async ({ from, to } = {}) => {
  const { fn, col } = db.Sequelize;
  const periodWhere = from && to ? { date: { [Op.between]: [from, to] } } : {};

  const sumByStatus = (where) =>
    CourierProductStock.findAll({
      where,
      attributes: ["status", [fn("SUM", col("amount")), "total"]],
      group: ["status"],
      raw: true,
    });

  const [periodRows, openingRows] = await Promise.all([
    sumByStatus(periodWhere),
    from
      ? sumByStatus({ date: { [Op.lt]: from } })
      : Promise.resolve([]),
  ]);

  const periodByStatus = new Map(
    periodRows.map((row) => [row.status, Number(row.total) || 0]),
  );
  const openingByStatus = new Map(
    openingRows.map((row) => [row.status, Number(row.total) || 0]),
  );

  const data = [
    ...new Set([...periodByStatus.keys(), ...openingByStatus.keys()]),
  ]
    .sort()
    .map((status) => {
      const openingAmount = openingByStatus.get(status) || 0;
      const periodAmount = periodByStatus.get(status) || 0;
      return {
        status,
        openingAmount,
        periodAmount,
        endingAmount: openingAmount + periodAmount,
      };
    });

  const sum = (key) => data.reduce((acc, row) => acc + row[key], 0);

  return {
    meta: {
      from: from || null,
      to: to || null,
      count: data.length,
      totalAmount: sum("periodAmount"),
      totalOpeningAmount: sum("openingAmount"),
      totalEndingAmount: sum("endingAmount"),
    },
    data,
  };
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getCourierProductStockReport,
};

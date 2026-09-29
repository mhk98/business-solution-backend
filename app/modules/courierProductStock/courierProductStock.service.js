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

// Courier product stock for the shared "All Books" / Monthly Reporting Book
// statement PDF and the Dashboard's Print/Download Book action (see
// inventoryOverview.service.js's getInventoryStockReport). Each entry is a
// stock snapshot, not a movement, so per status the balance is the amount of
// the latest entry: `endingAmount` = latest dated <= `to`, `openingAmount` =
// latest dated < `from`; `periodAmount` mirrors the ending snapshot (the
// amount shown for the period) and `date` is that latest entry's date.
const getCourierProductStockReport = async ({ from, to } = {}) => {
  const latestByStatus = async (dateCondition) => {
    const rows = await CourierProductStock.findAll({
      where: dateCondition ? { date: dateCondition } : {},
      attributes: ["Id", "status", "date", "amount"],
      order: [["date", "DESC"], ["createdAt", "DESC"], ["Id", "DESC"]],
      raw: true,
    });
    const latest = new Map();
    rows.forEach((row) => {
      if (!latest.has(row.status)) latest.set(row.status, row);
    });
    return latest;
  };

  const [endingByStatus, openingByStatus] = await Promise.all([
    latestByStatus(to ? { [Op.lte]: to } : null),
    from ? latestByStatus({ [Op.lt]: from }) : Promise.resolve(new Map()),
  ]);

  const data = [
    ...new Set([...endingByStatus.keys(), ...openingByStatus.keys()]),
  ]
    .sort()
    .map((status) => {
      const ending = endingByStatus.get(status);
      const openingAmount = Number(openingByStatus.get(status)?.amount || 0);
      const endingAmount = Number(ending?.amount || 0);
      return {
        status,
        date: ending?.date || null,
        openingAmount,
        periodAmount: endingAmount,
        endingAmount,
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

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const { ShifaIncentiveSearchableFields } = require("./shifaIncentive.constants");

const ShifaIncentive = db.shifaIncentive;

const normalizeNumber = (value, fieldName) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new ApiError(400, `${fieldName} must be a positive number`);
  }
  return numericValue;
};

const normalizePayload = (payload = {}) => {
  const employeeId = String(payload.employeeId || payload.employee_id || "").trim();
  if (!employeeId) throw new ApiError(400, "Employee Id is required");

  return {
    employeeId,
    totalOrder: normalizeNumber(payload.totalOrder, "Total Order"),
    totalAmount: normalizeNumber(payload.totalAmount, "Total Amount"),
    thousandPlusAmount: normalizeNumber(
      payload.thousandPlusAmount,
      "1000+ Amount",
    ),
    returnOrder: normalizeNumber(payload.returnOrder, "Return Order"),
    returnMinus: normalizeNumber(payload.returnMinus, "Return Minus"),
    totalIncentive: normalizeNumber(payload.totalIncentive, "Total Incentive"),
    date: payload.date || null,
    note: payload.note ? String(payload.note).trim() : null,
  };
};

const getWhereConditions = (filters = {}) => {
  const { searchTerm, startDate, endDate, ...filterData } = filters;
  const andConditions = [{ deletedAt: { [Op.is]: null } }];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ShifaIncentiveSearchableFields.map((field) => ({
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

  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });

  return { [Op.and]: andConditions };
};

const createIncentive = async (payload, user) => {
  const result = await ShifaIncentive.create({
    ...normalizePayload(payload),
    userId: user?.Id || null,
  });

  return getDataById(result.Id);
};

const getAllIncentives = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const whereConditions = getWhereConditions(filters);

  const data = await ShifaIncentive.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"], ["Id", "DESC"]],
  });

  const count = await ShifaIncentive.count({ where: whereConditions });
  return { meta: { count, page, limit }, data };
};

const getDataById = async (id) => {
  const result = await ShifaIncentive.findOne({ where: { Id: id } });
  if (!result) throw new ApiError(404, "Incentive not found");
  return result;
};

const updateIncentive = async (id, payload) => {
  const existing = await getDataById(id);
  await existing.update(
    normalizePayload({
      employeeId: payload.employeeId ?? existing.employeeId,
      totalOrder: payload.totalOrder ?? existing.totalOrder,
      totalAmount: payload.totalAmount ?? existing.totalAmount,
      thousandPlusAmount:
        payload.thousandPlusAmount ?? existing.thousandPlusAmount,
      returnOrder: payload.returnOrder ?? existing.returnOrder,
      returnMinus: payload.returnMinus ?? existing.returnMinus,
      totalIncentive: payload.totalIncentive ?? existing.totalIncentive,
      date: payload.date ?? existing.date,
      note: payload.note ?? existing.note,
    }),
  );

  return getDataById(id);
};

const deleteIncentive = async (id) => {
  const existing = await getDataById(id);
  await existing.destroy();
  return { deleted: true };
};

module.exports = {
  createIncentive,
  getAllIncentives,
  getDataById,
  updateIncentive,
  deleteIncentive,
};

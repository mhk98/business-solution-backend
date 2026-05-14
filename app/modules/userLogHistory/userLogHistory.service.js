const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const UserLogHistory = db.userLogHistory;
const User = db.user;

const buildDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return null;

  const range = {};

  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      throw new ApiError(400, "Invalid startDate. Use YYYY-MM-DD");
    }
    start.setHours(0, 0, 0, 0);
    range[Op.gte] = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      throw new ApiError(400, "Invalid endDate. Use YYYY-MM-DD");
    }
    end.setHours(23, 59, 59, 999);
    range[Op.lte] = end;
  }

  return range;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(options);
  const {
    searchTerm,
    userId,
    method,
    module,
    action,
    status,
    statusCode,
    startDate,
    endDate,
  } = filters;

  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      [Op.or]: [
        { action: { [Op.like]: `%${searchTerm}%` } },
        { module: { [Op.like]: `%${searchTerm}%` } },
        { route: { [Op.like]: `%${searchTerm}%` } },
        { userEmail: { [Op.like]: `%${searchTerm}%` } },
        { responseMessage: { [Op.like]: `%${searchTerm}%` } },
      ],
    });
  }

  if (userId) {
    andConditions.push({ userId: Number(userId) });
  }

  if (method) {
    andConditions.push({ method: String(method).toUpperCase() });
  }

  if (module) {
    andConditions.push({ module });
  }

  if (action) {
    andConditions.push({ action });
  }

  if (status) {
    andConditions.push({ status: String(status).toLowerCase() });
  }

  if (statusCode) {
    andConditions.push({ statusCode: Number(statusCode) });
  }

  const createdAtRange = buildDateRange(startDate, endDate);
  if (createdAtRange) {
    andConditions.push({ createdAt: createdAtRange });
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  const result = await UserLogHistory.findAll({
    where,
    include: [
      {
        model: User,
        as: "user",
        required: false,
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
      },
    ],
    offset: skip,
    limit,
    order: [[sortBy || "createdAt", sortOrder || "DESC"]],
  });

  const count = await UserLogHistory.count({ where });

  return {
    meta: { page, limit, count },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await UserLogHistory.findOne({
    where: { Id: id },
    include: [
      {
        model: User,
        as: "user",
        required: false,
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
      },
    ],
  });

  if (!result) {
    throw new ApiError(404, "User log history not found");
  }

  return result;
};

const UserLogHistoryService = {
  getAllFromDB,
  getDataById,
};

module.exports = UserLogHistoryService;

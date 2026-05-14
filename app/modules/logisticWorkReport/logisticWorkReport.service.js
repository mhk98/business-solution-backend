const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const {
  LogisticWorkReportNumericFields,
  LogisticWorkReportSearchableFields,
} = require("./logisticWorkReport.constants");

const LogisticWorkReport = db.logisticWorkReport;
const User = db.user;
const EmployeeList = db.employeeList;

const PRIVILEGED_ROLES = new Set(["superAdmin", "admin"]);

const reportIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["Id", "FirstName", "LastName", "Email", "role"],
    required: false,
  },
  {
    model: EmployeeList,
    as: "employee",
    attributes: ["Id", "name", "employeeCode", "employee_id", "departmentId"],
    required: false,
  },
];

const normalizeDate = (value, fallbackDate) =>
  String(value || fallbackDate || "").slice(0, 10);

const getActorName = (actor, employee) =>
  employee?.name ||
  `${actor?.FirstName || ""} ${actor?.LastName || ""}`.trim() ||
  actor?.Email ||
  "Employee";

const normalizeName = (value) => {
  const name = String(value || "").trim();
  if (!name) {
    throw new ApiError(400, "Name is required");
  }
  return name;
};

const normalizeNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new ApiError(400, `${fieldName} must be a positive number`);
  }

  return numberValue;
};

const buildPayload = (payload = {}, fallbackDate, fallbackName) => {
  const data = {
    reportDate: normalizeDate(payload.reportDate, fallbackDate),
    name: normalizeName(payload.name || fallbackName),
  };

  LogisticWorkReportNumericFields.forEach((field) => {
    data[field] = normalizeNumber(payload[field], field);
  });

  if (!data.reportDate) {
    throw new ApiError(400, "reportDate is required");
  }

  return data;
};

const getEmployeeProfile = async (userId) => {
  return EmployeeList.findOne({
    where: { userId },
    attributes: ["Id", "name", "employeeCode", "employee_id"],
  });
};

const getDataById = async (id, actor) => {
  const where = { Id: id };

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    where.userId = actor.Id;
  }

  const result = await LogisticWorkReport.findOne({
    where,
    include: reportIncludes,
  });

  if (!result) {
    throw new ApiError(404, "Logistic work report not found");
  }

  return result;
};

const createReport = async (payload, actor) => {
  const today = new Date().toISOString().slice(0, 10);
  const employee = await getEmployeeProfile(actor.Id);
  const data = buildPayload(payload, today, getActorName(actor, employee));

  const existing = await LogisticWorkReport.findOne({
    where: {
      userId: actor.Id,
      reportDate: data.reportDate,
    },
  });

  if (existing) {
    throw new ApiError(409, "You have already submitted this work report date");
  }

  const result = await LogisticWorkReport.create({
    userId: actor.Id,
    employeeId: employee?.Id || null,
    ...data,
  });

  return getDataById(result.Id, actor);
};

const updateReport = async (id, payload, actor) => {
  const existing = await LogisticWorkReport.findOne({
    where: { Id: id, userId: actor.Id },
  });

  if (!existing) {
    throw new ApiError(404, "Logistic work report not found");
  }

  const data = buildPayload(payload, existing.reportDate, existing.name);

  if (data.reportDate !== String(existing.reportDate).slice(0, 10)) {
    const duplicate = await LogisticWorkReport.findOne({
      where: {
        Id: { [Op.ne]: id },
        userId: actor.Id,
        reportDate: data.reportDate,
      },
    });

    if (duplicate) {
      throw new ApiError(409, "You have already submitted this work report date");
    }
  }

  await existing.update(data);
  return getDataById(id, actor);
};

const deleteReport = async (id, actor) => {
  const existing = await LogisticWorkReport.findOne({
    where: { Id: id, userId: actor.Id },
  });

  if (!existing) {
    throw new ApiError(404, "Logistic work report not found");
  }

  await existing.destroy();
  return { deleted: true };
};

const getMyReports = async (actor, filters, options) => {
  return getAllReports({ ...filters, userId: actor.Id }, options, actor);
};

const getAllReports = async (filters = {}, options = {}, actor) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, reportDate, userId, employeeId, startDate, endDate } =
    filters;
  const andConditions = [];

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    andConditions.push({ userId: actor.Id });
  }

  if (searchTerm && searchTerm.trim()) {
    const normalizedSearchTerm = searchTerm.trim();
    andConditions.push({
      [Op.or]: [
        ...LogisticWorkReportSearchableFields.map((field) => ({
          [field]: { [Op.like]: `%${normalizedSearchTerm}%` },
        })),
        { "$user.FirstName$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$user.LastName$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$user.Email$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$employee.name$": { [Op.like]: `%${normalizedSearchTerm}%` } },
      ],
    });
  }

  if (reportDate) {
    andConditions.push({ reportDate });
  }

  if (startDate && endDate) {
    andConditions.push({ reportDate: { [Op.between]: [startDate, endDate] } });
  } else if (startDate) {
    andConditions.push({ reportDate: { [Op.gte]: startDate } });
  } else if (endDate) {
    andConditions.push({ reportDate: { [Op.lte]: endDate } });
  }

  if (userId) {
    andConditions.push({ userId });
  }

  if (employeeId) {
    andConditions.push({ employeeId });
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, options.sortOrder.toUpperCase()]]
      : [
          ["reportDate", "DESC"],
          ["createdAt", "DESC"],
        ];

  const data = await LogisticWorkReport.findAll({
    where,
    offset: skip,
    limit,
    include: reportIncludes,
    order,
  });

  const count = await LogisticWorkReport.count({
    where,
    include: [
      {
        model: User,
        as: "user",
        attributes: [],
        required: false,
      },
      {
        model: EmployeeList,
        as: "employee",
        attributes: [],
        required: false,
      },
    ],
    distinct: true,
    col: "Id",
  });

  return { meta: { count, page, limit }, data };
};

module.exports = {
  createReport,
  updateReport,
  deleteReport,
  getMyReports,
  getAllReports,
  getDataById,
};

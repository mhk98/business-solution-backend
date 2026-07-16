const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const {
  ShifaReportNumericFields,
  ShifaReportSearchableFields,
  ShifaReportTextFields,
  ShifaReportTypeValues,
} = require("./shifaReport.constants");

const ShifaReport = db.shifaReport;
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
  "Patient";

const normalizeName = (value) => {
  const name = String(value || "").trim();
  if (!name) {
    throw new ApiError(400, "Name is required");
  }
  return name;
};

const normalizeReportType = (value) => {
  const reportType = String(value || "").trim();
  if (!ShifaReportTypeValues.includes(reportType)) {
    throw new ApiError(400, "Please select a valid shifa report type");
  }
  return reportType;
};

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
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

const normalizeDetails = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value) || typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new ApiError(400, "details must be valid JSON");
    }
  }

  throw new ApiError(400, "details must be an object or array");
};

const buildEmployeeFilter = async (employeeId) => {
  if (!employeeId) return null;

  const employee = await EmployeeList.findOne({
    where: { Id: employeeId },
    attributes: ["Id", "userId"],
    raw: true,
  });

  const employeeConditions = [{ employeeId }];
  if (employee?.userId) {
    employeeConditions.push({ userId: employee.userId });
  }

  return { [Op.or]: employeeConditions };
};

const buildPayload = (payload = {}, fallbackDate, fallbackName) => {
  const data = {
    reportDate: normalizeDate(payload.reportDate, fallbackDate),
    reportType: normalizeReportType(payload.reportType),
    name: normalizeName(payload.name || fallbackName),
    details: normalizeDetails(payload.details),
  };

  ShifaReportTextFields.forEach((field) => {
    data[field] = normalizeText(payload[field]);
  });

  ShifaReportNumericFields.forEach((field) => {
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

  const result = await ShifaReport.findOne({
    where,
    include: reportIncludes,
  });

  if (!result) {
    throw new ApiError(404, "Shifa report not found");
  }

  return result;
};

const createReport = async (payload, actor) => {
  const today = new Date().toISOString().slice(0, 10);
  const employee = await getEmployeeProfile(actor.Id);
  const data = buildPayload(payload, today, getActorName(actor, employee));

  const existing = await ShifaReport.findOne({
    where: {
      userId: actor.Id,
      reportDate: data.reportDate,
      reportType: data.reportType,
      name: data.name,
    },
  });

  if (existing) {
    throw new ApiError(409, "You have already submitted this shifa report");
  }

  const result = await ShifaReport.create({
    userId: actor.Id,
    employeeId: employee?.Id || null,
    ...data,
  });

  return getDataById(result.Id, actor);
};

const updateReport = async (id, payload, actor) => {
  const existing = await ShifaReport.findOne({
    where: { Id: id, userId: actor.Id },
  });

  if (!existing) {
    throw new ApiError(404, "Shifa report not found");
  }

  const data = buildPayload(
    { ...payload, reportType: payload.reportType || existing.reportType },
    existing.reportDate,
    existing.name,
  );

  const identityChanged =
    data.reportDate !== String(existing.reportDate).slice(0, 10) ||
    data.reportType !== existing.reportType ||
    data.name !== existing.name;

  if (identityChanged) {
    const duplicate = await ShifaReport.findOne({
      where: {
        Id: { [Op.ne]: id },
        userId: actor.Id,
        reportDate: data.reportDate,
        reportType: data.reportType,
        name: data.name,
      },
    });

    if (duplicate) {
      throw new ApiError(409, "You have already submitted this shifa report");
    }
  }

  await existing.update(data);
  return getDataById(id, actor);
};

const deleteReport = async (id, actor) => {
  const existing = await ShifaReport.findOne({
    where: { Id: id, userId: actor.Id },
  });

  if (!existing) {
    throw new ApiError(404, "Shifa report not found");
  }

  await existing.destroy();
  return { deleted: true };
};

const getMyReports = async (actor, filters, options) => {
  return getAllReports({ ...filters, userId: actor.Id }, options, actor);
};

const getAllReports = async (filters = {}, options = {}, actor) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const {
    searchTerm,
    reportType,
    name,
    phone,
    reportDate,
    userId,
    employeeId,
    startDate,
    endDate,
  } = filters;
  const andConditions = [];

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    andConditions.push({ userId: actor.Id });
  }

  if (searchTerm && searchTerm.trim()) {
    const normalizedSearchTerm = searchTerm.trim();
    andConditions.push({
      [Op.or]: [
        ...ShifaReportSearchableFields.map((field) => ({
          [field]: { [Op.like]: `%${normalizedSearchTerm}%` },
        })),
        { "$user.FirstName$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$user.LastName$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$user.Email$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$employee.name$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$employee.email$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$employee.employeeCode$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$employee.employee_id$": { [Op.like]: `%${normalizedSearchTerm}%` } },
      ],
    });
  }

  if (reportType) {
    andConditions.push({ reportType: normalizeReportType(reportType) });
  }

  if (reportDate) {
    andConditions.push({ reportDate });
  }

  if (name && name.trim()) {
    andConditions.push({ name: name.trim() });
  }

  if (phone && phone.trim()) {
    andConditions.push({ phone: phone.trim() });
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

  const employeeFilter = await buildEmployeeFilter(employeeId);
  if (employeeFilter) {
    andConditions.push(employeeFilter);
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, options.sortOrder.toUpperCase()]]
      : [
          ["reportDate", "DESC"],
          ["createdAt", "DESC"],
        ];

  const data = await ShifaReport.findAll({
    where,
    offset: skip,
    limit,
    include: reportIncludes,
    order,
    subQuery: false,
  });

  const aggregateIncludes = [
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
  ];

  const [count, typeRows, ...fieldTotals] = await Promise.all([
    ShifaReport.count({
      where,
      include: aggregateIncludes,
      distinct: true,
      col: "Id",
    }),
    ShifaReport.findAll({
      where,
      include: aggregateIncludes,
      attributes: [
        "reportType",
        [db.sequelize.fn("COUNT", db.sequelize.col("ShifaReport.Id")), "count"],
      ],
      group: ["reportType"],
      raw: true,
      subQuery: false,
    }),
    ...ShifaReportNumericFields.map((field) =>
      ShifaReport.sum(field, {
        where,
        include: aggregateIncludes,
        subQuery: false,
      }),
    ),
  ]);

  const totals = ShifaReportTypeValues.reduce(
    (acc, type) => ({ ...acc, [type]: 0 }),
    {},
  );
  typeRows.forEach((row) => {
    totals[row.reportType] = Number(row.count || 0);
  });
  ShifaReportNumericFields.forEach((field, index) => {
    totals[field] = Number(fieldTotals[index] || 0);
  });

  return { meta: { count, page, limit, totals }, data };
};

module.exports = {
  createReport,
  updateReport,
  deleteReport,
  getMyReports,
  getAllReports,
  getDataById,
};

const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { LOGISTIC_UPDATE_TYPES } = require("./logisticUpdate.constants");

const LogisticUpdate = db.logisticUpdate;
const User = db.user;
const EmployeeList = db.employeeList;
const Department = db.department;
const PRIVILEGED_ROLES = new Set(["superAdmin", "admin"]);

const updateIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["Id", "FirstName", "LastName", "Email", "role"],
    required: false,
  },
];

const employeeProfileInclude = [
  {
    model: Department,
    as: "department",
    attributes: ["Id", "name", "code"],
    required: false,
  },
];

const attachEmployeeProfiles = async (records, preferredDepartmentId = null) => {
  const rows = Array.isArray(records) ? records : [records];
  const plainRows = rows.map((row) => row?.get?.({ plain: true }) || row);
  const userIds = [...new Set(plainRows.map((row) => row?.userId).filter(Boolean))];

  if (!userIds.length) return Array.isArray(records) ? plainRows : plainRows[0];

  const profileWhere = { userId: { [Op.in]: userIds } };
  if (preferredDepartmentId) profileWhere.departmentId = preferredDepartmentId;

  const profiles = await EmployeeList.findAll({
    where: profileWhere,
    attributes: ["Id", "userId", "departmentId"],
    include: [
      ...employeeProfileInclude,
    ],
    order: [["Id", "DESC"]],
  });

  const profileByUserId = new Map();
  profiles.forEach((profile) => {
    const plainProfile = profile.get({ plain: true });
    if (!profileByUserId.has(plainProfile.userId)) {
      profileByUserId.set(plainProfile.userId, plainProfile);
    }
  });

  const result = plainRows.map((row) => ({
    ...row,
    user: row.user
      ? {
          ...row.user,
          employeeProfile: profileByUserId.get(row.userId) || null,
        }
      : row.user,
  }));

  return Array.isArray(records) ? result : result[0];
};

const normalizeDate = (value, label) => {
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, `${label} is required`);
  }
  return date;
};

const normalizePayload = (payload = {}) => {
  const startDate = normalizeDate(payload.startDate, "Start date");
  const endDate = normalizeDate(payload.endDate, "End date");
  const updateType = String(payload.updateType || "").trim();
  const quantity = Number(payload.quantity);

  if (startDate > endDate) {
    throw new ApiError(400, "End date cannot be earlier than start date");
  }
  if (!LOGISTIC_UPDATE_TYPES.includes(updateType)) {
    throw new ApiError(400, "Please select a valid logistic update type");
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ApiError(400, "Quantity must be a non-negative whole number");
  }

  return { startDate, endDate, updateType, quantity };
};

const getDataById = async (id, actor) => {
  const where = { Id: id };
  if (!PRIVILEGED_ROLES.has(actor.role)) where.userId = actor.Id;

  const result = await LogisticUpdate.findOne({ where, include: updateIncludes });
  if (!result) throw new ApiError(404, "Logistic update not found");
  return attachEmployeeProfiles(result);
};

const createUpdate = async (payload, actor) => {
  const result = await LogisticUpdate.create({
    userId: actor.Id,
    ...normalizePayload(payload),
  });
  return getDataById(result.Id, actor);
};

const updateOne = async (id, payload, actor) => {
  const where = { Id: id };
  if (!PRIVILEGED_ROLES.has(actor.role)) where.userId = actor.Id;

  const existing = await LogisticUpdate.findOne({ where });
  if (!existing) throw new ApiError(404, "Logistic update not found");

  await existing.update(normalizePayload(payload));
  return getDataById(id, actor);
};

const getAll = async (filters = {}, options = {}, actor) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { updateType, startDate, endDate, departmentId } = filters;
  const andConditions = [];

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    andConditions.push({ userId: actor.Id });
  }
  if (updateType) andConditions.push({ updateType });
  if (departmentId) {
    const normalizedDepartmentId = Number(departmentId);
    if (!Number.isInteger(normalizedDepartmentId) || normalizedDepartmentId <= 0) {
      throw new ApiError(400, "Please select a valid department");
    }
    const employees = await EmployeeList.findAll({
      where: { departmentId: normalizedDepartmentId },
      attributes: ["userId"],
      raw: true,
    });
    const userIds = employees.map((employee) => employee.userId).filter(Boolean);
    andConditions.push({ userId: { [Op.in]: userIds } });
  }

  // Include every saved range that overlaps the selected filter range.
  if (startDate) andConditions.push({ endDate: { [Op.gte]: startDate } });
  if (endDate) andConditions.push({ startDate: { [Op.lte]: endDate } });

  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const allowedSortFields = new Set(["startDate", "endDate", "updateType", "quantity", "createdAt"]);
  const sortBy = allowedSortFields.has(options.sortBy) ? options.sortBy : "startDate";
  const sortOrder = String(options.sortOrder || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const data = await LogisticUpdate.findAll({
    where,
    include: updateIncludes,
    offset: skip,
    limit,
    order: [[sortBy, sortOrder]],
  });
  const [count, totalQuantity] = await Promise.all([
    LogisticUpdate.count({ where }),
    LogisticUpdate.sum("quantity", { where }),
  ]);

  return {
    meta: { count, page, limit, totalQuantity: Number(totalQuantity || 0) },
    data: await attachEmployeeProfiles(data, departmentId ? Number(departmentId) : null),
  };
};

const getDepartments = async () =>
  Department.findAll({
    attributes: ["Id", "name", "code"],
    where: { status: "Active" },
    order: [["name", "ASC"]],
  });

module.exports = { createUpdate, updateOne, getAll, getDataById, getDepartments };

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const LeaveRequest = db.leaveRequest;
const LeaveType = db.leaveType;
const EmployeeList = db.employeeList;
const User = db.user;

const includes = [
  { model: EmployeeList, as: "employee", attributes: ["Id", "name", "employee_id", "employeeCode"], required: false },
  { model: LeaveType, as: "leaveType", attributes: ["Id", "name", "code", "isPaid"], required: false },
  { model: User, as: "requestedBy", attributes: ["Id", "FirstName", "LastName", "Email"], required: false },
  { model: User, as: "approvedBy", attributes: ["Id", "FirstName", "LastName", "Email"], required: false },
];

const dateDiffInclusive = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff + 1;
};

const sanitizePayload = (payload = {}) => {
  const startDate = payload.startDate;
  const endDate = payload.endDate || payload.startDate;
  if (!startDate || !endDate) throw new ApiError(400, "startDate and endDate are required");
  const approvalStatus = payload.approvalStatus || "Pending";

  return {
    employeeId: Number(payload.employeeId),
    leaveTypeId: Number(payload.leaveTypeId),
    startDate,
    endDate,
    totalDays: Number(payload.totalDays || dateDiffInclusive(startDate, endDate)),
    reason: payload.reason,
    approvalStatus,
    requestedByUserId: payload.requestedByUserId ? Number(payload.requestedByUserId) : null,
    approvedByUserId: payload.approvedByUserId ? Number(payload.approvedByUserId) : null,
    approvedAt: payload.approvedAt || null,
    note: approvalStatus === "Approved" ? null : payload.note || null,
  };
};

const insertIntoDB = async (payload) => {
  const data = sanitizePayload(payload);
  const result = await LeaveRequest.create(data);
  return LeaveRequest.findOne({ where: { Id: result.Id }, include: includes });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, from, to, ...otherFilters } = filters;
  const andConditions = [];
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: [
        { "$employee.name$": { [Op.like]: `%${searchTerm.trim()}%` } },
        { "$leaveType.name$": { [Op.like]: `%${searchTerm.trim()}%` } },
        { reason: { [Op.like]: `%${searchTerm.trim()}%` } },
      ],
    });
  }
  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });
  if (from && to) {
    andConditions.push({
      startDate: { [Op.lte]: to },
      endDate: { [Op.gte]: from },
    });
  }
  andConditions.push({ deletedAt: { [Op.is]: null } });
  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  const data = await LeaveRequest.findAll({
    where,
    include: includes,
    offset: skip,
    limit,
    paranoid: true,
    subQuery: false,
    order: [["createdAt", "DESC"]],
  });
  const count = await LeaveRequest.count({
    where,
    include: searchTerm ? includes : [],
    distinct: true,
    col: "Id",
  });
  return { meta: { count, page, limit }, data };
};

const getAllFromDBWithoutQuery = async () => LeaveRequest.findAll({ include: includes, paranoid: true, order: [["createdAt", "DESC"]] });
const getDataById = async (id) => LeaveRequest.findOne({ where: { Id: id }, include: includes });
const getMyLeaveRequests = async (userId, limit = 10) => {
  const employee = await EmployeeList.findOne({
    where: { userId },
    attributes: ["Id"],
  });

  if (!employee) {
    throw new ApiError(404, "Employee profile was not found for this user");
  }

  return LeaveRequest.findAll({
    where: { employeeId: employee.Id },
    include: includes,
    paranoid: true,
    limit,
    order: [["createdAt", "DESC"]],
  });
};
const updateOneFromDB = async (id, payload) => {
  const data = sanitizePayload(payload);
  await LeaveRequest.update(data, { where: { Id: id } });
  return getDataById(id);
};
const deleteIdFromDB = async (id) => LeaveRequest.destroy({ where: { Id: id } });

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  getMyLeaveRequests,
  updateOneFromDB,
  deleteIdFromDB,
};

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
  { model: User, as: "attendanceUser", attributes: ["Id", "FirstName", "LastName", "Email"], required: false },
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
  const isHalfDay = payload.isHalfDay === true || payload.isHalfDay === "true";
  const startDate = payload.startDate;
  // A half-day leave is always a single date.
  const endDate = isHalfDay ? payload.startDate : payload.endDate || payload.startDate;
  if (!startDate || !endDate) throw new ApiError(400, "startDate and endDate are required");
  const approvalStatus = payload.approvalStatus || "Pending";

  return {
    // Attendance reads userId; employeeId (EmployeeLists) is kept for old rows.
    employeeId: payload.employeeId ? Number(payload.employeeId) : null,
    userId: payload.userId ? Number(payload.userId) : null,
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
    isHalfDay,
    halfDaySession: isHalfDay ? payload.halfDaySession || "First Half" : null,
  };
};

// --- Notifications ------------------------------------------------------------
// The chosen approver (the department's team leader) is told about a new
// request, and the requester is told when it is approved or rejected.
// No leading slash: the notification dropdown navigates to `/${url}`.
const LEAVE_URL = "hrm/leave-requests";
const APPROVALS_URL = "leave-approvals";
const personName = (user) =>
  user ? [user.FirstName, user.LastName].filter(Boolean).join(" ").trim() || user.Email || `User #${user.Id}` : "";
const leaveDates = (row) =>
  String(row.startDate) === String(row.endDate)
    ? `${row.startDate}${row.isHalfDay ? ` (${row.halfDaySession || "half day"})` : ""}`
    : `${row.startDate} to ${row.endDate}`;

const notify = async (userId, message, url = LEAVE_URL) => {
  if (!userId) return;
  try {
    await db.notification.create({ userId, message, url });
  } catch (error) {
    console.error("[leaveRequest] notification failed:", error.message);
  }
};

const notifyLeaveChange = async (row, before, actor = {}) => {
  if (!row) return;
  const who = personName(row.attendanceUser) || personName(row.requestedBy) || "An employee";
  const type = row.leaveType?.name ? ` (${row.leaveType.name})` : "";
  const approverChanged = row.approvedByUserId && row.approvedByUserId !== before?.approvedByUserId;
  if (row.approvalStatus === "Pending" && approverChanged && Number(row.approvedByUserId) !== Number(actor.Id)) {
    await notify(
      row.approvedByUserId,
      `Leave request: ${who}${type}, ${leaveDates(row)} - waiting for your approval`,
      APPROVALS_URL,
    );
  }
  const decided = ["Approved", "Rejected"].includes(row.approvalStatus) && row.approvalStatus !== before?.approvalStatus;
  if (decided && before && Number(row.requestedByUserId) !== Number(actor.Id)) {
    await notify(
      row.requestedByUserId,
      `Your leave request for ${who}${type}, ${leaveDates(row)} was ${row.approvalStatus}${actor.Id ? ` by ${personName(actor)}` : ""}`,
    );
  }
};

const insertIntoDB = async (payload, user = {}) => {
  const data = sanitizePayload(payload);
  // Requested by the logged-in user unless the form says otherwise.
  if (!data.requestedByUserId && user.Id) data.requestedByUserId = user.Id;
  if (data.approvalStatus === "Approved" && !data.approvedAt) data.approvedAt = new Date();
  const result = await LeaveRequest.create(data);
  const row = await LeaveRequest.findOne({ where: { Id: result.Id }, include: includes });
  await notifyLeaveChange(row?.get({ plain: true }), null, user);
  return row;
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
// Requests waiting on (or decided by) the logged-in user as approver — open
// to any logged-in user, so a team leader needs no Leave Management access.
const getMyApprovals = async (user = {}) =>
  LeaveRequest.findAll({
    where: { approvedByUserId: user.Id },
    include: includes,
    order: [["createdAt", "DESC"]],
    limit: 200,
  });

// The assigned approver (or Super Admin / Admin) approves or rejects.
const decideLeave = async (id, { decision, note } = {}, user = {}) => {
  if (!["Approved", "Rejected"].includes(decision)) throw new ApiError(400, "decision must be Approved or Rejected");
  const before = await LeaveRequest.findOne({ where: { Id: id }, raw: true });
  if (!before) throw new ApiError(404, "Leave request not found");
  const privileged = ["superAdmin", "admin"].includes(user.role);
  if (!privileged && Number(before.approvedByUserId) !== Number(user.Id)) {
    throw new ApiError(403, "Only the selected approver can decide this leave request");
  }
  await LeaveRequest.update(
    {
      approvalStatus: decision,
      approvedByUserId: before.approvedByUserId || user.Id,
      approvedAt: new Date(),
      note: note ? String(note).slice(0, 255) : before.note,
    },
    { where: { Id: id } },
  );
  const row = await getDataById(id);
  await notifyLeaveChange(row?.get({ plain: true }), before, user);
  return row;
};

const updateOneFromDB = async (id, payload, user = {}) => {
  const before = await LeaveRequest.findOne({ where: { Id: id }, raw: true });
  if (!before) throw new ApiError(404, "Leave request not found");
  const data = sanitizePayload(payload);
  if (!data.requestedByUserId) data.requestedByUserId = before.requestedByUserId || user.Id || null;
  if (data.approvalStatus === "Approved" && !data.approvedAt) data.approvedAt = before.approvedAt || new Date();
  await LeaveRequest.update(data, { where: { Id: id } });
  const row = await getDataById(id);
  await notifyLeaveChange(row?.get({ plain: true }), before, user);
  return row;
};
const deleteIdFromDB = async (id) => LeaveRequest.destroy({ where: { Id: id } });

module.exports = {
  getMyApprovals,
  decideLeave,
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  getMyLeaveRequests,
  updateOneFromDB,
  deleteIdFromDB,
};

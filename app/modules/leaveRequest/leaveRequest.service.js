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
  { model: User, as: "hrApprovedBy", attributes: ["Id", "FirstName", "LastName", "Email"], required: false },
];

// Two-step approval: Pending (team leader) → Leader Approved (HR) → Approved.
// Only "Approved" is counted by attendance. HR = role hr; superAdmin/admin
// can act on either step.
const PENDING = "Pending";
const LEADER_APPROVED = "Leader Approved";
const APPROVED = "Approved";
const REJECTED = "Rejected";
const CANCELLED = "Cancelled";
const STATUSES = [PENDING, LEADER_APPROVED, APPROVED, REJECTED, CANCELLED];
const OPEN_STATUSES = [PENDING, LEADER_APPROVED];
const isPrivileged = (user = {}) => ["superAdmin", "admin"].includes(user.role);
const isHr = (user = {}) => user.role === "hr" || isPrivileged(user);

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
  const approvalStatus = STATUSES.includes(payload.approvalStatus) ? payload.approvalStatus : PENDING;

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
    note: payload.note || null,
    isHalfDay,
    halfDaySession: isHalfDay ? payload.halfDaySession || "First Half" : null,
  };
};

// --- Notifications ------------------------------------------------------------
// The chosen approver (the department's team leader) is told about a new
// request, and the requester is told when it is approved or rejected.
// No leading slash: the notification dropdown navigates to `/${url}`.
const LEAVE_URL = "hrm/leave-requests";
const MY_LEAVE_URL = "my-leave";
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

// Active HR users get the second step (superAdmin when no HR user exists).
const hrUserIds = async () => {
  for (const role of ["hr", "superAdmin"]) {
    const users = await User.findAll({ where: { role }, attributes: ["Id", "status"], raw: true });
    const ids = users.filter((u) => !u.status || String(u.status).toLowerCase() === "active").map((u) => u.Id);
    if (ids.length) return ids;
  }
  return [];
};

const notifyLeaveChange = async (row, before, actor = {}) => {
  if (!row) return;
  const who = personName(row.attendanceUser) || personName(row.requestedBy) || "An employee";
  const type = row.leaveType?.name ? ` (${row.leaveType.name})` : "";
  const by = actor.Id ? ` by ${personName(actor)}` : "";
  const statusChanged = row.approvalStatus !== before?.approvalStatus;
  const approverChanged = row.approvedByUserId && row.approvedByUserId !== before?.approvedByUserId;
  if (row.approvalStatus === PENDING && approverChanged && Number(row.approvedByUserId) !== Number(actor.Id)) {
    await notify(
      row.approvedByUserId,
      `Leave request: ${who}${type}, ${leaveDates(row)} - waiting for your approval`,
      APPROVALS_URL,
    );
  }
  // Leader approved (or no team leader set) → HR's turn.
  const toHr =
    (row.approvalStatus === LEADER_APPROVED && statusChanged) ||
    (row.approvalStatus === PENDING && !row.approvedByUserId && !before);
  if (toHr) {
    const ids = (await hrUserIds()).filter((id) => Number(id) !== Number(actor.Id));
    const step = row.approvalStatus === LEADER_APPROVED ? `approved by team leader${by}` : "no team leader set";
    for (const id of ids) {
      await notify(id, `Leave request: ${who}${type}, ${leaveDates(row)} - ${step}, waiting for HR approval`, APPROVALS_URL);
    }
  }
  const decided = [LEADER_APPROVED, APPROVED, REJECTED].includes(row.approvalStatus) && statusChanged;
  if (decided && before && Number(row.requestedByUserId) !== Number(actor.Id)) {
    const outcome =
      row.approvalStatus === LEADER_APPROVED ? "approved by the team leader and sent to HR" : row.approvalStatus.toLowerCase();
    // The employee's own request opens My Leave; one filed for someone else
    // opens Leave Requests.
    const url = Number(row.requestedByUserId) === Number(row.userId) ? MY_LEAVE_URL : LEAVE_URL;
    await notify(row.requestedByUserId, `Your leave request for ${who}${type}, ${leaveDates(row)} was ${outcome}${by}`, url);
  }
};

// Only HR (or superAdmin/admin) may set a status from the form; anyone else
// keeps the current one (Pending on a new request).
const guardStatus = (data, before, user = {}) => {
  if (isHr(user)) {
    if (data.approvalStatus === APPROVED) {
      data.hrApprovedByUserId = (before?.approvalStatus === APPROVED && before.hrApprovedByUserId) || user.Id || null;
      data.hrApprovedAt = (before?.approvalStatus === APPROVED && before.hrApprovedAt) || new Date();
      data.approvedAt = data.approvedAt || data.hrApprovedAt;
    }
    if (data.approvalStatus === LEADER_APPROVED && !before?.leaderApprovedAt) data.leaderApprovedAt = new Date();
    return data;
  }
  data.approvalStatus = before?.approvalStatus || PENDING;
  data.approvedAt = before?.approvedAt || null;
  return data;
};

const insertIntoDB = async (payload, user = {}) => {
  const data = guardStatus(sanitizePayload(payload), null, user);
  // Requested by the logged-in user unless the form says otherwise.
  if (!data.requestedByUserId && user.Id) data.requestedByUserId = user.Id;
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
// The logged-in user's own leave (the attendance person is the User).
const getMyLeaveRequests = async (userId, limit = 10) =>
  LeaveRequest.findAll({
    where: { userId },
    include: includes,
    paranoid: true,
    limit,
    order: [["createdAt", "DESC"]],
  });

// --- Self service (My Leave) -------------------------------------------------
// Any logged-in user applies for themself: the approver is their department's
// team leader, the status always starts Pending.
const myTeamLeader = async (userId) => {
  const me = await User.findOne({
    where: { Id: userId },
    attributes: ["Id", "departmentId"],
    include: [{ model: db.department, as: "attendanceDepartment", attributes: ["Id", "name", "teamLeaderUserId"], required: false }],
  });
  const department = me?.attendanceDepartment || null;
  const leaderId = department?.teamLeaderUserId && Number(department.teamLeaderUserId) !== Number(userId)
    ? department.teamLeaderUserId
    : null;
  const leader = leaderId ? await User.findOne({ where: { Id: leaderId }, attributes: ["Id", "FirstName", "LastName", "Email"], raw: true }) : null;
  return { department: department ? { Id: department.Id, name: department.name } : null, teamLeader: leader };
};

const getMyLeave = async (user = {}, { year } = {}) => {
  const AttendanceService = require("../attendance/attendance.service");
  const [requests, balance, leader, leaveTypes] = await Promise.all([
    getMyLeaveRequests(user.Id, 200),
    AttendanceService.getLeaveBalance({ year, userId: user.Id }).catch(() => null),
    myTeamLeader(user.Id),
    LeaveType.findAll({ where: { status: { [Op.ne]: "Inactive" } }, attributes: ["Id", "name", "code", "isPaid", "daysPerYear"], order: [["name", "ASC"]], raw: true }),
  ]);
  const row = balance?.rows?.[0];
  return {
    ...leader,
    leaveTypes,
    year: balance?.year,
    balances: leaveTypes.map((type) => {
      const b = row?.balances?.find((item) => Number(item.leaveTypeId) === Number(type.Id));
      const entitled = Number(type.daysPerYear || 0);
      return { leaveTypeId: type.Id, name: type.name, entitled, used: b?.used || 0, pending: b?.pending || 0, remaining: b ? b.remaining : entitled };
    }),
    requests,
  };
};

const applyMyLeave = async (payload = {}, user = {}) => {
  if (!payload.leaveTypeId) throw new ApiError(400, "Select a leave type");
  if (!String(payload.reason || "").trim()) throw new ApiError(400, "Reason is required");
  const data = sanitizePayload({
    leaveTypeId: payload.leaveTypeId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    isHalfDay: payload.isHalfDay,
    halfDaySession: payload.halfDaySession,
    reason: String(payload.reason).trim().slice(0, 255),
  });
  if (data.endDate < data.startDate) throw new ApiError(400, "End date cannot be before the start date");
  const overlap = await LeaveRequest.findOne({
    where: {
      userId: user.Id,
      approvalStatus: { [Op.in]: [...OPEN_STATUSES, APPROVED] },
      startDate: { [Op.lte]: data.endDate },
      endDate: { [Op.gte]: data.startDate },
    },
    raw: true,
  });
  if (overlap) {
    throw new ApiError(400, `You already have a leave request for ${leaveDates(overlap)} (${overlap.approvalStatus})`);
  }
  const { teamLeader } = await myTeamLeader(user.Id);
  const result = await LeaveRequest.create({
    ...data,
    userId: user.Id,
    employeeId: null,
    requestedByUserId: user.Id,
    approvedByUserId: teamLeader?.Id || null,
    approvalStatus: PENDING,
    approvedAt: null,
    note: null,
  });
  const row = await getDataById(result.Id);
  await notifyLeaveChange(row?.get({ plain: true }), null, user);
  return row;
};

// The employee withdraws their own request while it is still waiting.
const cancelMyLeave = async (id, user = {}) => {
  const before = await LeaveRequest.findOne({ where: { Id: id }, raw: true });
  if (!before) throw new ApiError(404, "Leave request not found");
  const mine = [before.userId, before.requestedByUserId].some((value) => Number(value) === Number(user.Id));
  if (!mine) throw new ApiError(403, "You can only cancel your own leave request");
  if (!OPEN_STATUSES.includes(before.approvalStatus)) {
    throw new ApiError(400, `This leave request is already ${before.approvalStatus}; ask HR to change it`);
  }
  await LeaveRequest.update({ approvalStatus: CANCELLED }, { where: { Id: id } });
  return getDataById(id);
};

// Sidebar badge: is this user an approver at all, and how many wait on them.
// Also feeds the self-service menus: isTeamLeader shows My Team Attendance,
// and HR's count includes pending attendance corrections.
const getMyApprovalCount = async (user = {}) => {
  const leads = await db.department.count({ where: { teamLeaderUserId: user.Id } });
  const isApprover = isHr(user) || leads > 0;
  if (!isApprover) return { isApprover: false, isTeamLeader: false, isHr: false, count: 0, leaveCount: 0, correctionCount: 0 };
  const or = [{ approvalStatus: PENDING, approvedByUserId: user.Id }];
  if (isHr(user)) or.push({ approvalStatus: LEADER_APPROVED }, { approvalStatus: PENDING, approvedByUserId: null });
  const { pendingCorrectionCount } = require("../attendance/attendance.self");
  const [leaveCount, correctionCount] = await Promise.all([
    LeaveRequest.count({ where: { [Op.or]: or } }),
    pendingCorrectionCount(user),
  ]);
  return {
    isApprover,
    isTeamLeader: leads > 0,
    isHr: isHr(user),
    count: leaveCount + correctionCount,
    leaveCount,
    correctionCount,
  };
};
// Requests on the logged-in user's desk: as team leader, and for HR every
// leader-approved request (plus Pending ones with no team leader). Open to any
// logged-in user, so a team leader needs no Leave Management access.
const getMyApprovals = async (user = {}) => {
  const or = [{ approvedByUserId: user.Id }, { hrApprovedByUserId: user.Id }];
  if (isHr(user)) {
    or.push({ approvalStatus: LEADER_APPROVED }, { approvalStatus: PENDING, approvedByUserId: null });
  }
  const rows = await LeaveRequest.findAll({
    where: { [Op.or]: or },
    include: includes,
    order: [["createdAt", "DESC"]],
    limit: 300,
  });
  // `actionable` tells the page which rows this user can approve right now.
  return rows.map((row) => {
    const plain = row.get({ plain: true });
    const leaderStep = plain.approvalStatus === PENDING && (Number(plain.approvedByUserId) === Number(user.Id) || isPrivileged(user));
    const hrStep =
      isHr(user) &&
      (plain.approvalStatus === LEADER_APPROVED || (plain.approvalStatus === PENDING && !plain.approvedByUserId));
    return { ...plain, actionable: leaderStep || hrStep, step: plain.approvalStatus === LEADER_APPROVED || !plain.approvedByUserId ? "hr" : "leader" };
  });
};

// Step 1: the team leader (approvedByUserId) approves → "Leader Approved".
// Step 2: HR approves → "Approved" (the leave now counts). Either can reject.
// A Pending request with no team leader goes straight to HR.
const decideLeave = async (id, { decision, note } = {}, user = {}) => {
  if (![APPROVED, REJECTED].includes(decision)) throw new ApiError(400, "decision must be Approved or Rejected");
  const before = await LeaveRequest.findOne({ where: { Id: id }, raw: true });
  if (!before) throw new ApiError(404, "Leave request not found");
  const now = new Date();
  const data = { note: note ? String(note).slice(0, 255) : before.note };

  if (before.approvalStatus === PENDING && before.approvedByUserId) {
    if (!isPrivileged(user) && Number(before.approvedByUserId) !== Number(user.Id)) {
      throw new ApiError(403, "Only the team leader can approve this leave request first");
    }
    Object.assign(data, { approvalStatus: decision === APPROVED ? LEADER_APPROVED : REJECTED, leaderApprovedAt: now });
  } else if (before.approvalStatus === LEADER_APPROVED || before.approvalStatus === PENDING) {
    if (!isHr(user)) throw new ApiError(403, "This leave request is waiting for HR approval");
    Object.assign(data, { approvalStatus: decision, hrApprovedByUserId: user.Id, hrApprovedAt: now });
    if (decision === APPROVED) data.approvedAt = now;
  } else {
    throw new ApiError(400, `This leave request is already ${before.approvalStatus}`);
  }

  await LeaveRequest.update(data, { where: { Id: id } });
  const row = await getDataById(id);
  await notifyLeaveChange(row?.get({ plain: true }), before, user);
  return row;
};

const updateOneFromDB = async (id, payload, user = {}) => {
  const before = await LeaveRequest.findOne({ where: { Id: id }, raw: true });
  if (!before) throw new ApiError(404, "Leave request not found");
  const data = guardStatus(sanitizePayload(payload), before, user);
  if (!data.requestedByUserId) data.requestedByUserId = before.requestedByUserId || user.Id || null;
  await LeaveRequest.update(data, { where: { Id: id } });
  const row = await getDataById(id);
  await notifyLeaveChange(row?.get({ plain: true }), before, user);
  return row;
};
const deleteIdFromDB = async (id) => LeaveRequest.destroy({ where: { Id: id } });

module.exports = {
  getMyLeave,
  applyMyLeave,
  cancelMyLeave,
  getMyApprovalCount,
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

// Self service: My Attendance (every logged-in user, own data only — the
// person always comes from the login, never from the request) and My Team
// Attendance (department team leaders). Attendance corrections asked from
// here go to HR only; HR approves on Attendance → Correction Approvals.
const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const AttendanceService = require("./attendance.service");
const { bdToday, bdToInstant, clockToMinutes, addDays, isYmd } = require("./attendance.time");

const PENDING = "Pending";
const CORRECTIONS_URL = "attendance-correction-approvals";
const MY_ATTENDANCE_URL = "my-attendance";
const REQUEST_TYPES = ["Missing Punch", "Manual In/Out", "Wrong Device Punch"];

const userIncludes = ["attendanceUser", "requestedBy", "approvedBy"].map((as) => ({
  model: db.user,
  as,
  attributes: ["Id", "FirstName", "LastName", "Email"],
  required: false,
}));

const personName = (user) =>
  user ? [user.FirstName, user.LastName].filter(Boolean).join(" ").trim() || user.Email || `User #${user.Id}` : "";

const notify = async (userIds, message, url) => {
  for (const userId of [...new Set(userIds.filter(Boolean).map(Number))]) {
    try {
      await db.notification.create({ userId, message, url });
    } catch (error) {
      console.error("[attendance.self] notification failed:", error.message);
    }
  }
};

// HR = role hr (superAdmin when no HR user exists).
const hrUserIds = async () => {
  for (const role of ["hr", "superAdmin"]) {
    const users = await db.user.findAll({ where: { role }, attributes: ["Id", "status"], raw: true });
    const ids = users.filter((u) => !u.status || String(u.status).toLowerCase() === "active").map((u) => u.Id);
    if (ids.length) return ids;
  }
  return [];
};

const isHr = (user = {}) => ["hr", "admin", "superAdmin"].includes(user.role);

// Corrections may only be asked for the current month, up to today.
const correctionWindow = () => {
  const today = bdToday();
  return { from: `${today.slice(0, 7)}-01`, to: today };
};

// --- My Attendance --------------------------------------------------------------

const getMyAttendance = async (user = {}, { month } = {}) => {
  const me = await db.user.findByPk(user.Id, { attributes: ["Id", "attendanceExempt"], raw: true });
  if (!me) throw new ApiError(404, "User not found");
  const [jobCard, corrections] = await Promise.all([
    AttendanceService.getJobCard({ userId: user.Id, month }),
    db.attendanceRegularization.findAll({
      where: { userId: user.Id },
      include: userIncludes,
      order: [["attendanceDate", "DESC"], ["createdAt", "DESC"]],
      limit: 100,
    }),
  ]);
  return {
    ...jobCard,
    exempt: Boolean(me.attendanceExempt),
    today: bdToday(),
    correctionWindow: correctionWindow(),
    requestTypes: REQUEST_TYPES,
    corrections,
  };
};

const applyCorrection = async (user = {}, payload = {}) => {
  const date = String(payload.date || "");
  if (!isYmd(date)) throw new ApiError(400, "Select the date");
  const window = correctionWindow();
  if (date < window.from || date > window.to) {
    throw new ApiError(400, `Correction can only be asked for this month, ${window.from} to ${window.to}`);
  }
  const inTime = payload.inTime ? String(payload.inTime).slice(0, 5) : "";
  const outTime = payload.outTime ? String(payload.outTime).slice(0, 5) : "";
  if (!inTime && !outTime) throw new ApiError(400, "Give the correct in time, out time or both");
  if ((inTime && clockToMinutes(inTime) === null) || (outTime && clockToMinutes(outTime) === null)) {
    throw new ApiError(400, "Time must be HH:MM");
  }
  const reason = String(payload.reason || "").trim();
  if (!reason) throw new ApiError(400, "Reason is required");

  const open = await db.attendanceRegularization.findOne({
    where: { userId: user.Id, attendanceDate: date, approvalStatus: PENDING },
    raw: true,
  });
  if (open) throw new ApiError(400, `You already have a pending correction for ${date}`);

  // An out time earlier than the in time is the next morning (night shift).
  const outDate = inTime && outTime && clockToMinutes(outTime) < clockToMinutes(inTime) ? addDays(date, 1) : date;
  const created = await db.attendanceRegularization.create({
    userId: user.Id,
    employeeId: null,
    attendanceDate: date,
    requestType: REQUEST_TYPES.includes(payload.requestType) ? payload.requestType : REQUEST_TYPES[0],
    requestedIn: inTime ? bdToInstant(date, inTime) : null,
    requestedOut: outTime ? bdToInstant(outDate, outTime) : null,
    reason: reason.slice(0, 255),
    requestedByUserId: user.Id,
    approvedByUserId: null,
    approvalStatus: PENDING,
  });

  const who = personName(await db.user.findByPk(user.Id, { attributes: ["Id", "FirstName", "LastName", "Email"], raw: true }));
  const times = [inTime && `in ${inTime}`, outTime && `out ${outTime}`].filter(Boolean).join(", ");
  await notify(
    (await hrUserIds()).filter((id) => Number(id) !== Number(user.Id)),
    `Attendance correction: ${who}, ${date} (${times}) - waiting for HR approval`,
    CORRECTIONS_URL,
  );
  return db.attendanceRegularization.findOne({ where: { Id: created.Id }, include: userIncludes });
};

const cancelCorrection = async (user = {}, id) => {
  const row = await db.attendanceRegularization.findOne({ where: { Id: id }, raw: true });
  if (!row) throw new ApiError(404, "Correction request not found");
  if (Number(row.userId) !== Number(user.Id) && Number(row.requestedByUserId) !== Number(user.Id)) {
    throw new ApiError(403, "You can only cancel your own correction request");
  }
  if (row.approvalStatus !== PENDING) throw new ApiError(400, `This request is already ${row.approvalStatus}`);
  await db.attendanceRegularization.update({ approvalStatus: "Cancelled" }, { where: { Id: id } });
  return { Id: Number(id), approvalStatus: "Cancelled" };
};

// --- HR approval of corrections ---------------------------------------------------

const getCorrectionApprovals = async (user = {}) => {
  if (!isHr(user)) return [];
  return db.attendanceRegularization.findAll({
    where: {
      userId: { [Op.ne]: null },
      [Op.or]: [{ approvalStatus: PENDING }, { approvedByUserId: user.Id }],
    },
    include: userIncludes,
    order: [["createdAt", "DESC"]],
    limit: 300,
  });
};

// Approving turns the requested in/out into manual punches (model hook) and
// recomputes that day.
const decideCorrection = async (user = {}, id, { decision, note } = {}) => {
  if (!isHr(user)) throw new ApiError(403, "Only HR can approve attendance corrections");
  if (!["Approved", "Rejected"].includes(decision)) throw new ApiError(400, "decision must be Approved or Rejected");
  const before = await db.attendanceRegularization.findOne({ where: { Id: id }, raw: true });
  if (!before) throw new ApiError(404, "Correction request not found");
  if (before.approvalStatus !== PENDING) throw new ApiError(400, `This request is already ${before.approvalStatus}`);
  await db.attendanceRegularization.update(
    {
      approvalStatus: decision,
      approvedByUserId: user.Id,
      approvedAt: new Date(),
      note: note ? String(note).slice(0, 255) : before.note,
    },
    { where: { Id: id } },
  );
  if (Number(before.requestedByUserId || before.userId) !== Number(user.Id)) {
    const actor = await db.user.findByPk(user.Id, { attributes: ["Id", "FirstName", "LastName", "Email"], raw: true });
    await notify(
      [before.requestedByUserId || before.userId],
      `Your attendance correction for ${before.attendanceDate} was ${decision.toLowerCase()} by ${personName(actor)}`,
      MY_ATTENDANCE_URL,
    );
  }
  return db.attendanceRegularization.findOne({ where: { Id: id }, include: userIncludes });
};

const pendingCorrectionCount = async (user = {}) =>
  isHr(user) ? db.attendanceRegularization.count({ where: { userId: { [Op.ne]: null }, approvalStatus: PENDING } }) : 0;

// --- My Team Attendance (team leaders) -----------------------------------------------

const ledDepartments = (user = {}) =>
  db.department.findAll({ where: { teamLeaderUserId: user.Id }, attributes: ["Id", "name"], order: [["name", "ASC"]], raw: true });

const getMyTeam = async (user = {}, { date, month } = {}) => {
  const departments = await ledDepartments(user);
  if (!departments.length) throw new ApiError(403, "You are not the team leader of any department");
  const day = date && isYmd(date) ? date : bdToday();
  const results = await Promise.all(
    departments.map(async (department) => {
      const [daily, monthly] = await Promise.all([
        AttendanceService.getDaily({ date: day, departmentId: department.Id }),
        AttendanceService.getMonthly({ month: month || day.slice(0, 7), departmentId: department.Id }),
      ]);
      return { department, daily, monthly };
    }),
  );
  return {
    date: day,
    month: String(results[0].monthly.from).slice(0, 7),
    departments: results.map(({ department, daily, monthly }) => ({
      ...department,
      counts: daily.counts,
      today: daily.rows,
      monthly: monthly.rows,
    })),
  };
};

const getTeamJobCard = async (user = {}, { employeeId, month } = {}) => {
  const departments = await ledDepartments(user);
  const member = await db.user.findByPk(employeeId, { attributes: ["Id", "departmentId"], raw: true });
  if (!member || !departments.some((department) => Number(department.Id) === Number(member.departmentId))) {
    throw new ApiError(403, "This person is not in your team");
  }
  return AttendanceService.getJobCard({ userId: member.Id, month });
};

const isTeamLeader = async (user = {}) => (await db.department.count({ where: { teamLeaderUserId: user.Id } })) > 0;

module.exports = {
  getMyAttendance,
  applyCorrection,
  cancelCorrection,
  getCorrectionApprovals,
  decideCorrection,
  pendingCorrectionCount,
  getMyTeam,
  getTeamJobCard,
  isTeamLeader,
};

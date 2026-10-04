const crypto = require("crypto");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { getPolicy, updatePolicy } = require("./attendance.policy");
const { employeePin, isTrackedEmployee, buildPinOwners } = require("./attendance.engine");
const { recomputeNow, scheduleRecompute } = require("./attendance.recompute");
const {
  addDays,
  bdToday,
  clockToMinutes,
  dateRange,
  isYmd,
  maxYmd,
  minYmd,
  monthBounds,
  normalizeWeekdays,
} = require("./attendance.time");

const { Op } = db.Sequelize;

const DAY_STATUSES = ["Present", "Half Day", "Absent", "Leave", "Half Leave", "Holiday", "Weekly Off"];

const n = (value) => Number(value || 0);
const round1 = (value) => Math.round(value * 10) / 10;

const requireYmd = (value, label) => {
  if (!isYmd(value)) throw new ApiError(400, `${label} must be YYYY-MM-DD`);
  return value;
};

const requireMonth = (month) => {
  const bounds = monthBounds(month || bdToday().slice(0, 7));
  if (!bounds) throw new ApiError(400, "month must be YYYY-MM");
  return bounds;
};

// Attendance people = Users (login accounts). Name, department and default
// shift come from the user's own attendance fields.
const USER_ATTRIBUTES = [
  "Id",
  "FirstName",
  "LastName",
  "Email",
  "role",
  "status",
  "attendancePin",
  "attendanceExempt",
  "joiningDate",
  "exitDate",
  "shiftId",
  "departmentId",
];

const userName = (user) => [user.FirstName, user.LastName].filter(Boolean).join(" ").trim() || user.Email || `User #${user.Id}`;

const loadEmployees = async ({ departmentId, searchTerm, userId } = {}) => {
  const where = {};
  if (departmentId) where.departmentId = departmentId;
  if (userId) where.Id = userId;
  if (searchTerm && String(searchTerm).trim()) {
    const raw = String(searchTerm).trim();
    const term = `%${raw}%`;
    where[Op.or] = [
      { FirstName: { [Op.like]: term } },
      { LastName: { [Op.like]: term } },
      { Email: { [Op.like]: term } },
      { attendancePin: { [Op.like]: term } },
      ...(/^\d+$/.test(raw) ? [{ Id: Number(raw) }] : []),
    ];
  }
  const rows = await db.user.findAll({
    where,
    attributes: USER_ATTRIBUTES,
    include: [
      { model: db.department, as: "attendanceDepartment", attributes: ["Id", "name", "teamLeaderUserId"], required: false },
      { model: db.shift, as: "attendanceShift", attributes: ["Id", "name", "startTime", "endTime"], required: false },
    ],
    order: [["FirstName", "ASC"], ["LastName", "ASC"]],
  });
  return rows.map((row) => {
    const user = row.get({ plain: true });
    return { ...user, name: userName(user), department: user.attendanceDepartment, shift: user.attendanceShift };
  });
};

const employeeInfo = (employee) => ({
  Id: employee.Id,
  name: employee.name,
  pin: employeePin(employee),
  role: employee.role || null,
  department: employee.department?.name || null,
  departmentId: employee.departmentId || null,
});

// Rows from before the move to Users carry no userId and are skipped.
const loadDays = (where) =>
  db.attendanceDay.findAll({
    where: { userId: { [Op.ne]: null }, ...where },
    raw: true,
    order: [["attendanceDate", "ASC"]],
  });

// Totals over a set of AttendanceDays (one employee).
const summarize = (days, policy) => {
  const totals = {
    days: days.length,
    workingDays: 0,
    present: 0,
    absent: 0,
    leave: 0,
    paidLeave: 0,
    unpaidLeave: 0,
    halfDays: 0,
    holidays: 0,
    weeklyOffs: 0,
    offDayWorked: 0,
    holidayWorked: 0,
    weeklyOffWorked: 0,
    lateDays: 0,
    lateMinutes: 0,
    earlyLeaveDays: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    workedMinutes: 0,
    missingPunch: 0,
    pending: 0,
  };
  days.forEach((day) => {
    const off = day.status === "Holiday" || day.status === "Weekly Off";
    if (day.status === "Holiday") totals.holidays += 1;
    if (day.status === "Weekly Off") totals.weeklyOffs += 1;
    if (day.status === "Pending") totals.pending += 1;
    if (!off && day.status !== "Pending") totals.workingDays += 1;
    if (day.workedOnOffDay) {
      totals.offDayWorked += 1;
      if (day.status === "Holiday") totals.holidayWorked += 1;
      if (day.status === "Weekly Off") totals.weeklyOffWorked += 1;
    }
    if (day.status === "Half Day") totals.halfDays += 1;
    totals.present += n(day.presentValue);
    totals.absent += n(day.absentValue);
    totals.leave += n(day.leaveValue);
    if (n(day.leaveValue)) {
      if (day.leaveIsPaid === false || day.leaveIsPaid === 0) totals.unpaidLeave += n(day.leaveValue);
      else totals.paidLeave += n(day.leaveValue);
    }
    if (day.isLate) {
      totals.lateDays += 1;
      totals.lateMinutes += n(day.lateMinutes);
    }
    if (day.isEarlyLeave) {
      totals.earlyLeaveDays += 1;
      totals.earlyLeaveMinutes += n(day.earlyLeaveMinutes);
    }
    if (day.isMissingPunch) totals.missingPunch += 1;
    totals.overtimeMinutes += n(day.overtimeMinutes);
    totals.workedMinutes += n(day.workedMinutes);
  });

  const lateDeduction = policy.lateDaysPerAbsent ? Math.floor(totals.lateDays / policy.lateDaysPerAbsent) : 0;
  const earlyDeduction = policy.earlyLeaveDaysPerAbsent
    ? Math.floor(totals.earlyLeaveDays / policy.earlyLeaveDaysPerAbsent)
    : 0;
  const counted = totals.days - totals.pending;
  const extraPaidDays =
    (policy.holidayWorkPaid ? totals.holidayWorked : 0) + (policy.weeklyOffWorkPaid ? totals.weeklyOffWorked : 0);
  return {
    ...totals,
    present: round1(totals.present),
    absent: round1(totals.absent),
    leave: round1(totals.leave),
    paidLeave: round1(totals.paidLeave),
    unpaidLeave: round1(totals.unpaidLeave),
    lateDeductionDays: lateDeduction,
    earlyLeaveDeductionDays: earlyDeduction,
    // Days the employee is paid for under these rules (information only —
    // payroll is calculated separately).
    extraPaidDays,
    payableDays: round1(
      Math.max(0, counted - totals.absent - totals.unpaidLeave - lateDeduction - earlyDeduction) + extraPaidDays,
    ),
    attendancePercent: totals.workingDays
      ? Math.round(((totals.present + totals.paidLeave) / totals.workingDays) * 100)
      : 0,
  };
};

// --- Reports -----------------------------------------------------------------

const getDaily = async ({ date, departmentId, status, searchTerm } = {}) => {
  const day = date ? requireYmd(date, "date") : bdToday();
  const [policy, employees] = await Promise.all([getPolicy(), loadEmployees({ departmentId, searchTerm })]);
  const ids = employees.map((employee) => employee.Id);
  const rows = ids.length ? await loadDays({ attendanceDate: day, userId: { [Op.in]: ids } }) : [];
  const byEmployee = new Map(rows.map((row) => [Number(row.userId), row]));

  const employedOn = (employee) =>
    (!employee.joiningDate || String(employee.joiningDate).slice(0, 10) <= day) &&
    (!employee.exitDate || String(employee.exitDate).slice(0, 10) >= day);
  let list = employees
    .filter((employee) => byEmployee.has(employee.Id) || (isTrackedEmployee(employee) && employedOn(employee)))
    .map((employee) => ({ employee: employeeInfo(employee), day: byEmployee.get(employee.Id) || null }));

  const counts = { total: list.length, Present: 0, Late: 0, "Early Leave": 0, "Half Day": 0, Absent: 0, Leave: 0, "Half Leave": 0, Holiday: 0, "Weekly Off": 0, Pending: 0, "No Record": 0 };
  list.forEach(({ day: row }) => {
    if (!row) counts["No Record"] += 1;
    else {
      counts[row.status] = (counts[row.status] || 0) + 1;
      if (row.isLate) counts.Late += 1;
      if (row.isEarlyLeave) counts["Early Leave"] += 1;
    }
  });

  if (status) {
    list = list.filter(({ day: row }) => {
      if (status === "Late") return row?.isLate;
      if (status === "Early Leave") return row?.isEarlyLeave;
      if (status === "Missing Punch") return row?.isMissingPunch;
      if (status === "No Record") return !row;
      return row?.status === status;
    });
  }

  return {
    date: day,
    trackFromDate: policy.trackFromDate,
    beforeTracking: day < policy.trackFromDate,
    counts,
    rows: list,
  };
};

const getMonthly = async ({ month, from, to, departmentId, searchTerm } = {}) => {
  const range = from && to ? { from: requireYmd(from, "from"), to: requireYmd(to, "to") } : requireMonth(month);
  const [policy, employees] = await Promise.all([getPolicy(), loadEmployees({ departmentId, searchTerm })]);
  const ids = employees.map((employee) => employee.Id);
  const rows = ids.length
    ? await loadDays({ attendanceDate: { [Op.between]: [range.from, range.to] }, userId: { [Op.in]: ids } })
    : [];
  const byEmployee = rows.reduce((acc, row) => {
    (acc[row.userId] = acc[row.userId] || []).push(row);
    return acc;
  }, {});

  return {
    ...range,
    policy: {
      lateDaysPerAbsent: policy.lateDaysPerAbsent,
      earlyLeaveDaysPerAbsent: policy.earlyLeaveDaysPerAbsent,
      holidayWorkPaid: policy.holidayWorkPaid,
      weeklyOffWorkPaid: policy.weeklyOffWorkPaid,
      trackFromDate: policy.trackFromDate,
    },
    rows: employees
      .filter((employee) => byEmployee[employee.Id] || isTrackedEmployee(employee))
      .map((employee) => ({
        employee: employeeInfo(employee),
        totals: summarize(byEmployee[employee.Id] || [], policy),
      })),
  };
};

const getJobCard = async ({ userId, month } = {}) => {
  if (!userId) throw new ApiError(400, "employeeId is required");
  const range = requireMonth(month);
  const [policy, employees] = await Promise.all([getPolicy(), loadEmployees({ userId })]);
  const employee = employees[0];
  if (!employee) throw new ApiError(404, "User not found");

  const [rows, punches] = await Promise.all([
    loadDays({ userId, attendanceDate: { [Op.between]: [range.from, range.to] } }),
    findEmployeePunches(employee, addDays(range.from, -1), addDays(range.to, 1)),
  ]);
  const byDate = new Map(rows.map((row) => [row.attendanceDate, row]));
  const punchesByDate = punches.reduce((acc, punch) => {
    (acc[punch.punchDate] = acc[punch.punchDate] || []).push(punch);
    return acc;
  }, {});

  return {
    ...range,
    employee: { ...employeeInfo(employee), shift: employee.shift?.name || null, joiningDate: employee.joiningDate },
    days: dateRange(range.from, range.to).map((date) => ({
      date,
      day: byDate.get(date) || null,
      punches: (punchesByDate[date] || []).map((punch) => ({
        Id: punch.Id,
        clock: punch.punchClock,
        source: punch.source,
        note: punch.note,
      })),
    })),
    totals: summarize(rows, policy),
  };
};

const findEmployeePunches = (employee, from, to) => {
  const pin = employeePin(employee);
  return db.attendancePunch.findAll({
    where: {
      punchDate: { [Op.between]: [from, to] },
      [Op.or]: [{ userId: employee.Id }, ...(pin ? [{ userId: null, employeePin: pin }] : [])],
    },
    order: [["punchDate", "ASC"], ["punchClock", "ASC"]],
    raw: true,
  });
};

const getPunches = async ({ from, to, userId, pin, source, limit } = {}) => {
  const end = to ? requireYmd(to, "to") : bdToday();
  const start = from ? requireYmd(from, "from") : end;
  const where = { punchDate: { [Op.between]: [start, end] } };
  if (source) where.source = source;
  if (pin) where.employeePin = String(pin).trim();

  const employees = await loadEmployees();
  const pinOwners = buildPinOwners(employees.filter(isTrackedEmployee));
  const byId = new Map(employees.map((employee) => [employee.Id, employee]));
  if (userId) {
    const employee = byId.get(Number(userId));
    if (!employee) throw new ApiError(404, "User not found");
    const employeePinValue = employeePin(employee);
    where[Op.or] = [
      { userId: employee.Id },
      ...(employeePinValue ? [{ userId: null, employeePin: employeePinValue }] : []),
    ];
  }

  const rows = await db.attendancePunch.findAll({
    where,
    attributes: { exclude: ["rawPayload"] },
    order: [["punchDate", "DESC"], ["punchClock", "DESC"]],
    limit: Math.min(Number(limit) || 2000, 5000),
    raw: true,
  });
  return rows.map((row) => {
    const ownerIds = row.userId ? [Number(row.userId)] : pinOwners.get(String(row.employeePin || "").trim()) || [];
    return {
      ...row,
      employees: ownerIds.map((id) => byId.get(id)).filter(Boolean).map((employee) => ({ Id: employee.Id, name: employee.name })),
    };
  });
};

const getDashboard = async ({ date } = {}) => {
  const today = date ? requireYmd(date, "date") : bdToday();
  const monthFrom = `${today.slice(0, 7)}-01`;
  const [daily, policy] = await Promise.all([getDaily({ date: today }), getPolicy()]);
  const monthRows = await loadDays({ attendanceDate: { [Op.between]: [monthFrom, today] } });
  const byEmployee = monthRows.reduce((acc, row) => {
    (acc[row.userId] = acc[row.userId] || []).push(row);
    return acc;
  }, {});
  const monthly = Object.values(byEmployee).map((rows) => summarize(rows, policy));
  const goodAttendance = monthly.filter((totals) => totals.attendancePercent >= 80).length;

  return {
    date: today,
    totalEmployees: daily.counts.total,
    presentToday: daily.counts.Present + daily.counts["Half Day"],
    lateToday: daily.counts.Late,
    earlyLeaveToday: daily.counts["Early Leave"],
    absentToday: daily.counts.Absent,
    onLeaveToday: daily.counts.Leave + daily.counts["Half Leave"],
    offToday: daily.counts.Holiday + daily.counts["Weekly Off"],
    pendingToday: daily.counts.Pending,
    activeEmployees: goodAttendance,
    inactiveEmployees: Math.max(monthly.length - goodAttendance, 0),
  };
};

// --- Recompute / manual corrections ------------------------------------------

const recompute = async ({ from, to, userId } = {}) => {
  const end = to ? requireYmd(to, "to") : bdToday();
  const start = from ? requireYmd(from, "from") : end;
  if (start > end) throw new ApiError(400, "from must not be after to");
  return recomputeNow({ from: start, to: end, employeeIds: userId ? [Number(userId)] : null });
};

const addManualPunch = async ({ userId, date, time, note } = {}, user = {}) => {
  if (!userId) throw new ApiError(400, "employeeId is required");
  requireYmd(date, "date");
  if (clockToMinutes(time) === null) throw new ApiError(400, "time must be HH:MM");
  const employee = await db.user.findByPk(userId, { attributes: ["Id"] });
  if (!employee) throw new ApiError(404, "User not found");
  const clock = String(time).length === 5 ? `${time}:00` : String(time).slice(0, 8);
  const row = await db.attendancePunch.create({
    punchKey: `manual:${crypto.randomUUID()}`,
    userId: employee.Id,
    punchDate: date,
    punchClock: clock,
    source: "manual",
    note: note ? String(note).slice(0, 255) : null,
    createdByUserId: user.Id || null,
  });
  await recomputeNow({ from: addDays(date, -1), to: date, employeeIds: [employee.Id] });
  return row;
};

const deleteManualPunch = async (id) => {
  const row = await db.attendancePunch.findByPk(id);
  if (!row) throw new ApiError(404, "Punch not found");
  if (row.source !== "manual") {
    throw new ApiError(400, "Only manual punches can be deleted here; device punches are kept as recorded");
  }
  const { userId, punchDate } = row;
  await row.destroy();
  await recomputeNow({ from: addDays(punchDate, -1), to: punchDate, employeeIds: [userId] });
  return { deleted: true };
};

const OVERRIDE_VALUES = {
  Present: { presentValue: 1, absentValue: 0, leaveValue: 0 },
  "Half Day": { presentValue: 0.5, absentValue: 0.5, leaveValue: 0 },
  Absent: { presentValue: 0, absentValue: 1, leaveValue: 0 },
  Leave: { presentValue: 0, absentValue: 0, leaveValue: 1 },
  "Half Leave": { presentValue: 0.5, absentValue: 0, leaveValue: 0.5 },
  Holiday: { presentValue: 0, absentValue: 0, leaveValue: 0 },
  "Weekly Off": { presentValue: 0, absentValue: 0, leaveValue: 0 },
};

// Sets a day's status by hand and locks it against the engine.
const overrideDay = async ({ userId, date, status, note, clearLate, clearEarlyLeave } = {}, user = {}) => {
  if (!userId) throw new ApiError(400, "employeeId is required");
  requireYmd(date, "date");
  if (!OVERRIDE_VALUES[status]) throw new ApiError(400, `status must be one of: ${DAY_STATUSES.join(", ")}`);
  if (date > bdToday()) throw new ApiError(400, "A future date cannot be overridden");
  if (!note || !String(note).trim()) throw new ApiError(400, "A note is required for a manual override");

  const existing = await db.attendanceDay.findOne({ where: { userId, attendanceDate: date } });
  const keepFlags = status === "Present" || status === "Half Day" || status === "Half Leave";
  const patch = {
    status,
    ...OVERRIDE_VALUES[status],
    isLate: keepFlags && !clearLate ? Boolean(existing?.isLate) : false,
    lateMinutes: keepFlags && !clearLate ? n(existing?.lateMinutes) : 0,
    isEarlyLeave: keepFlags && !clearEarlyLeave ? Boolean(existing?.isEarlyLeave) : false,
    earlyLeaveMinutes: keepFlags && !clearEarlyLeave ? n(existing?.earlyLeaveMinutes) : 0,
    leaveIsPaid: status === "Leave" || status === "Half Leave" ? existing?.leaveIsPaid ?? true : null,
    source: "manual",
    isLocked: true,
    lockedByUserId: user.Id || null,
    manualNote: String(note).trim().slice(0, 255),
  };
  if (existing) await existing.update(patch);
  else await db.attendanceDay.create({ userId, attendanceDate: date, ...patch });
  return db.attendanceDay.findOne({ where: { userId, attendanceDate: date }, raw: true });
};

const clearOverride = async ({ userId, date } = {}) => {
  if (!userId) throw new ApiError(400, "employeeId is required");
  requireYmd(date, "date");
  await db.attendanceDay.update(
    { isLocked: false, lockedByUserId: null, manualNote: null, source: "auto" },
    { where: { userId, attendanceDate: date } },
  );
  await recomputeNow({ from: date, to: date, employeeIds: [Number(userId)] });
  return db.attendanceDay.findOne({ where: { userId, attendanceDate: date }, raw: true });
};

// --- Shift assignments -----------------------------------------------------------

const assignmentIncludes = [
  { model: db.user, as: "user", attributes: ["Id", "FirstName", "LastName", "Email"], required: false },
  { model: db.shift, as: "shift", attributes: ["Id", "name", "startTime", "endTime", "weeklyOffDays"], required: false },
];

const listAssignments = async ({ userId, shiftId, activeOn, searchTerm } = {}) => {
  const where = {};
  if (userId) where.userId = userId;
  if (shiftId) where.shiftId = shiftId;
  if (activeOn && isYmd(activeOn)) {
    where.effectiveFrom = { [Op.lte]: activeOn };
    where[Op.or] = [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: activeOn } }];
  }
  let rows = (
    await db.employeeShiftAssignment.findAll({
      where,
      include: assignmentIncludes,
      order: [["effectiveFrom", "DESC"], ["Id", "DESC"]],
    })
  ).map((row) => {
    const plain = row.get({ plain: true });
    return { ...plain, employee: plain.user ? { Id: plain.user.Id, name: userName(plain.user) } : null };
  });
  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        String(row.employee?.name || "").toLowerCase().includes(term) ||
        String(row.shift?.name || "").toLowerCase().includes(term),
    );
  }
  return rows;
};

const cleanAssignment = (payload = {}) => {
  const effectiveFrom = requireYmd(payload.effectiveFrom, "effectiveFrom");
  const effectiveTo = payload.effectiveTo ? requireYmd(payload.effectiveTo, "effectiveTo") : null;
  if (effectiveTo && effectiveTo < effectiveFrom) throw new ApiError(400, "effectiveTo must not be before effectiveFrom");
  if (!payload.shiftId) throw new ApiError(400, "shiftId is required");
  const weeklyOffDays =
    payload.weeklyOffDays === undefined || payload.weeklyOffDays === null || payload.weeklyOffDays === ""
      ? null
      : normalizeWeekdays(payload.weeklyOffDays);
  const clock = (value, label) => {
    if (value === undefined || value === null || value === "") return null;
    if (!/^\d{1,2}:\d{2}$/.test(String(value).slice(0, 5))) throw new ApiError(400, `${label} must be HH:MM`);
    return String(value).slice(0, 5);
  };
  const minutes = (value) =>
    value === undefined || value === null || value === "" ? null : Math.max(0, Math.floor(Number(value) || 0));
  const startTime = clock(payload.startTime, "Office start");
  const endTime = clock(payload.endTime, "Office end");
  if (Boolean(startTime) !== Boolean(endTime)) throw new ApiError(400, "Give both office start and end, or neither");
  return {
    shiftId: Number(payload.shiftId),
    effectiveFrom,
    effectiveTo,
    weeklyOffDays,
    startTime,
    endTime,
    graceInMinutes: minutes(payload.graceInMinutes),
    graceOutMinutes: minutes(payload.graceOutMinutes),
    note: payload.note ? String(payload.note).slice(0, 255) : null,
  };
};

// Assigns a shift to one or more employees from a date. An open assignment
// that started earlier is closed the day before; one that starts on/after
// the new date (and would overlap) is rejected.
const createAssignments = async (payload = {}, user = {}) => {
  const ids = (Array.isArray(payload.userIds) ? payload.userIds : [])
    .map(Number)
    .filter(Boolean);
  if (!ids.length) throw new ApiError(400, "Select at least one employee");
  const data = cleanAssignment(payload);
  const shift = await db.shift.findByPk(data.shiftId);
  if (!shift) throw new ApiError(404, "Shift not found");

  return db.sequelize.transaction(async (transaction) => {
    const created = [];
    for (const userId of ids) {
      const overlapping = await db.employeeShiftAssignment.findAll({
        where: {
          userId,
          ...(data.effectiveTo ? { effectiveFrom: { [Op.lte]: data.effectiveTo } } : {}),
          [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: data.effectiveFrom } }],
        },
        transaction,
      });
      for (const row of overlapping) {
        if (row.effectiveFrom >= data.effectiveFrom) {
          throw new ApiError(
            400,
            `User #${userId} already has a shift from ${row.effectiveFrom}; edit or delete it first`,
          );
        }
        await row.update({ effectiveTo: addDays(data.effectiveFrom, -1) }, { transaction });
      }
      created.push(
        await db.employeeShiftAssignment.create(
          { ...data, userId, createdByUserId: user.Id || null },
          { transaction },
        ),
      );
    }
    return created;
  });
};

const updateAssignment = async (id, payload = {}) => {
  const row = await db.employeeShiftAssignment.findByPk(id);
  if (!row) throw new ApiError(404, "Shift assignment not found");
  const data = cleanAssignment({ ...row.get({ plain: true }), ...payload });
  const clash = await db.employeeShiftAssignment.findOne({
    where: {
      Id: { [Op.ne]: row.Id },
      userId: row.userId,
      ...(data.effectiveTo ? { effectiveFrom: { [Op.lte]: data.effectiveTo } } : {}),
      [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: data.effectiveFrom } }],
    },
  });
  if (clash) throw new ApiError(400, `Overlaps the assignment starting ${clash.effectiveFrom}`);
  await row.update(data);
  return row;
};

const deleteAssignment = async (id) => {
  const row = await db.employeeShiftAssignment.findByPk(id);
  if (!row) throw new ApiError(404, "Shift assignment not found");
  await row.destroy();
  return { deleted: true };
};

// --- Employee setup (PIN mapping etc.) -------------------------------------------

const getSetup = async () => {
  const today = bdToday();
  const [employees, assignments, deviceUsers, recentPins] = await Promise.all([
    loadEmployees(),
    listAssignments({ activeOn: today }),
    db.zktecoDeviceUser
      ? db.zktecoDeviceUser.findAll({ attributes: ["serialNumber", "pin", "name", "lastSeenAt"], raw: true })
      : [],
    db.attendancePunch.findAll({
      where: { userId: null, punchDate: { [Op.gte]: addDays(today, -60) } },
      attributes: [
        "employeePin",
        [db.sequelize.fn("COUNT", db.sequelize.col("Id")), "punches"],
        [db.sequelize.fn("MAX", db.sequelize.col("punchDate")), "lastPunchDate"],
      ],
      group: ["employeePin"],
      raw: true,
    }),
  ]);

  const tracked = employees.filter(isTrackedEmployee);
  const pinOwners = buildPinOwners(tracked);
  const assignmentByEmployee = new Map(assignments.map((row) => [Number(row.userId), row]));
  const punchesByPin = new Map(recentPins.map((row) => [String(row.employeePin || "").trim(), row]));
  const deviceUserByPin = new Map(deviceUsers.map((row) => [String(row.pin).trim(), row]));

  const rows = employees.map((employee) => {
    const pin = employeePin(employee);
    const assignment = assignmentByEmployee.get(employee.Id);
    return {
      ...employeeInfo(employee),
      attendancePin: employee.attendancePin || null,
      pinSource: employee.attendancePin ? "attendancePin" : "userId",
      attendanceExempt: Boolean(employee.attendanceExempt),
      joiningDate: employee.joiningDate,
      exitDate: employee.exitDate,
      status: employee.status,
      tracked: isTrackedEmployee(employee),
      defaultShift: employee.shift ? { Id: employee.shift.Id, name: employee.shift.name } : null,
      currentShift: assignment?.shift
        ? { Id: assignment.shift.Id, name: assignment.shift.name, from: assignment.effectiveFrom }
        : null,
      pinConflict: Boolean(pin && (pinOwners.get(pin) || []).length > 1),
      onDevice: Boolean(pin && deviceUserByPin.has(pin)),
      lastPunchDate: punchesByPin.get(pin)?.lastPunchDate || null,
    };
  });

  const knownPins = new Set(pinOwners.keys());
  const unmatchedPins = [...new Set([...punchesByPin.keys(), ...deviceUserByPin.keys()])]
    .filter((pin) => pin && !knownPins.has(pin))
    .map((pin) => ({
      pin,
      deviceName: deviceUserByPin.get(pin)?.name || null,
      punches: Number(punchesByPin.get(pin)?.punches || 0),
      lastPunchDate: punchesByPin.get(pin)?.lastPunchDate || null,
    }))
    .sort((a, b) => b.punches - a.punches);

  return { employees: rows, unmatchedPins, policy: await getPolicy() };
};

const updateEmployeeSetup = async (id, payload = {}) => {
  const employee = await db.user.findByPk(id);
  if (!employee) throw new ApiError(404, "User not found");
  const patch = {};
  if (payload.attendancePin !== undefined) {
    const pin = String(payload.attendancePin || "").trim();
    patch.attendancePin = pin || null;
  }
  if (payload.attendanceExempt !== undefined) {
    patch.attendanceExempt = payload.attendanceExempt === true || payload.attendanceExempt === "true";
  }
  if (payload.joiningDate !== undefined) {
    patch.joiningDate = payload.joiningDate ? requireYmd(payload.joiningDate, "joiningDate") : null;
  }
  if (payload.exitDate !== undefined) {
    patch.exitDate = payload.exitDate ? requireYmd(payload.exitDate, "exitDate") : null;
  }
  if (payload.shiftId !== undefined) patch.shiftId = payload.shiftId ? Number(payload.shiftId) : null;
  if (payload.departmentId !== undefined) {
    patch.departmentId = payload.departmentId ? Number(payload.departmentId) : null;
  }
  await employee.update(patch, { fields: Object.keys(patch) });
  return employee;
};

// Users for the pickers (shift assignment, leave, correction). scope=all
// also returns exempt users (e.g. approvers, requesters); each row carries
// the leader of the person's department and the departments they lead.
const getPeople = async ({ scope } = {}) => {
  const [people, departments] = await Promise.all([
    loadEmployees(),
    db.department.findAll({
      where: { teamLeaderUserId: { [Op.ne]: null } },
      attributes: ["Id", "name", "teamLeaderUserId"],
      raw: true,
    }),
  ]);
  const leads = departments.reduce((acc, department) => {
    (acc[department.teamLeaderUserId] = acc[department.teamLeaderUserId] || []).push(department.name);
    return acc;
  }, {});
  return people
    .filter((person) =>
      scope === "all" ? !/inactive|deactive/i.test(String(person.status || "")) : isTrackedEmployee(person),
    )
    .map((person) => ({
      ...employeeInfo(person),
      exempt: Boolean(person.attendanceExempt),
      status: person.status,
      teamLeaderUserId: person.department?.teamLeaderUserId || null,
      leaderOf: leads[person.Id] || [],
    }));
};

// --- Leave balance -----------------------------------------------------------------

const getLeaveBalance = async ({ year, userId } = {}) => {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : bdToday().slice(0, 4);
  const from = `${y}-01-01`;
  const to = `${y}-12-31`;
  const [employees, types, requests, days] = await Promise.all([
    loadEmployees({ userId }),
    db.leaveType.findAll({ where: { status: { [Op.ne]: "Inactive" } }, raw: true, order: [["name", "ASC"]] }),
    db.leaveRequest.findAll({
      where: {
        ...(userId ? { userId } : {}),
        startDate: { [Op.lte]: to },
        endDate: { [Op.gte]: from },
        approvalStatus: { [Op.in]: ["Approved", "Pending"] },
      },
      raw: true,
    }),
    loadDays({
      ...(userId ? { userId } : {}),
      attendanceDate: { [Op.between]: [from, to] },
      leaveTypeId: { [Op.ne]: null },
    }),
  ]);
  const policy = await getPolicy();

  // Approved leave inside tracked dates is counted from AttendanceDays (so
  // holidays/weekly offs inside a leave are not charged); before tracking
  // started, calendar days of the request are used.
  const usedFromDays = {};
  days.forEach((day) => {
    const key = `${day.userId}|${day.leaveTypeId}`;
    usedFromDays[key] = (usedFromDays[key] || 0) + n(day.leaveValue);
  });
  const usedBeforeTracking = {};
  const pending = {};
  requests.forEach((request) => {
    const key = `${request.userId}|${request.leaveTypeId}`;
    const start = maxYmd(String(request.startDate).slice(0, 10), from);
    const end = minYmd(String(request.endDate).slice(0, 10), to);
    if (request.approvalStatus === "Pending") {
      pending[key] = (pending[key] || 0) + (request.isHalfDay ? 0.5 : dateRange(start, end).length);
      return;
    }
    const untrackedEnd = minYmd(end, addDays(policy.trackFromDate, -1));
    if (start <= untrackedEnd) {
      usedBeforeTracking[key] =
        (usedBeforeTracking[key] || 0) + (request.isHalfDay ? 0.5 : dateRange(start, untrackedEnd).length);
    }
  });

  return {
    year: y,
    leaveTypes: types.map((type) => ({ Id: type.Id, name: type.name, daysPerYear: n(type.daysPerYear), isPaid: type.isPaid !== false })),
    rows: employees.filter(isTrackedEmployee).map((employee) => ({
      employee: employeeInfo(employee),
      balances: types.map((type) => {
        const key = `${employee.Id}|${type.Id}`;
        const used = round1((usedFromDays[key] || 0) + (usedBeforeTracking[key] || 0));
        return {
          leaveTypeId: type.Id,
          entitled: n(type.daysPerYear),
          used,
          pending: round1(pending[key] || 0),
          remaining: round1(n(type.daysPerYear) - used),
        };
      }),
    })),
  };
};

const getPolicyWithShifts = async () => ({
  policy: await getPolicy({ fresh: true }),
  shifts: await db.shift.findAll({ attributes: ["Id", "name", "startTime", "endTime", "status"], raw: true }),
});

const savePolicy = async (payload, user) => {
  const before = await getPolicy({ fresh: true });
  const policy = await updatePolicy(payload, user);
  // Rules changed: refresh this month (and back to a moved tracking start).
  const today = bdToday();
  const from = minYmd(`${today.slice(0, 7)}-01`, before.trackFromDate, policy.trackFromDate);
  if (before.trackFromDate !== policy.trackFromDate && policy.trackFromDate > before.trackFromDate) {
    await db.attendanceDay.destroy({
      where: { attendanceDate: { [Op.lt]: policy.trackFromDate }, isLocked: false },
    });
  }
  scheduleRecompute({ from: maxYmd(from, policy.trackFromDate), to: today }, 500);
  return policy;
};

module.exports = {
  DAY_STATUSES,
  getDaily,
  getMonthly,
  getJobCard,
  getPunches,
  getDashboard,
  recompute,
  addManualPunch,
  deleteManualPunch,
  overrideDay,
  clearOverride,
  listAssignments,
  createAssignments,
  updateAssignment,
  deleteAssignment,
  getSetup,
  updateEmployeeSetup,
  getLeaveBalance,
  getPeople,
  getPolicyWithShifts,
  savePolicy,
  summarize,
};

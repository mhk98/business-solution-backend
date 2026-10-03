// Builds AttendanceDays from punches + shift + holiday + leave for a date
// range. Safe to re-run any number of times: rows are upserted per
// (employee, date), and locked (manually overridden) rows are left alone.

const db = require("../../../models");
const { getPolicy } = require("./attendance.policy");
const {
  addDays,
  bdNowMinutes,
  bdToday,
  clockToMinutes,
  dateRange,
  dayDiff,
  maxYmd,
  minYmd,
  normalizeWeekdays,
  weekdayName,
} = require("./attendance.time");
const { applySandwichRule, evaluateDay, normalizeShift, punchWindow } = require("./attendance.rules");

const { Op } = db.Sequelize;

const SANDWICH_CONTEXT_DAYS = 7;
const INACTIVE_STATUS_RE = /deactive|inactive|reject|resign|terminat|left/i;

const WRITE_FIELDS = [
  "shiftId",
  "shiftStart",
  "shiftEnd",
  "inTime",
  "outTime",
  "punchCount",
  "workedMinutes",
  "lateMinutes",
  "earlyLeaveMinutes",
  "overtimeMinutes",
  "status",
  "isLate",
  "isEarlyLeave",
  "isMissingPunch",
  "workedOnOffDay",
  "presentValue",
  "absentValue",
  "leaveValue",
  "leaveIsPaid",
  "holidayId",
  "leaveRequestId",
  "leaveTypeId",
  "remarks",
  "source",
  "computedAt",
];

const EMPLOYEE_ATTRIBUTES = [
  "Id",
  "name",
  "employee_id",
  "employeeCode",
  "attendancePin",
  "attendanceExempt",
  "joiningDate",
  "exitDate",
  "status",
  "shiftId",
  "departmentId",
];

// The PIN an employee punches with on the device.
const employeePin = (employee) =>
  String(employee?.attendancePin || employee?.employee_id || employee?.employeeCode || "").trim();

const isTrackedEmployee = (employee) =>
  !employee.attendanceExempt && !INACTIVE_STATUS_RE.test(String(employee.status || ""));

const isActiveRecord = (row) => ["active", "approved"].includes(String(row.status || "active").toLowerCase());

const holidayRange = (holiday) => {
  const from = String(holiday.startDate || holiday.holidayDate || "").slice(0, 10);
  const to = String(holiday.endDate || from).slice(0, 10);
  return { from, to };
};

const holidayAppliesTo = (holiday, employee) => {
  let departments = holiday.departmentIds;
  if (typeof departments === "string") {
    try {
      departments = JSON.parse(departments);
    } catch {
      departments = [];
    }
  }
  if (!Array.isArray(departments) || !departments.length) return true;
  return departments.map(Number).includes(Number(employee.departmentId));
};

const loadContext = async ({ ctxFrom, ctxTo, employeeIds }) => {
  const employeeWhere = employeeIds ? { Id: { [Op.in]: employeeIds } } : {};
  const [employees, shifts, assignments, holidays, leaves, punches] = await Promise.all([
    db.employeeList.findAll({ where: employeeWhere, attributes: EMPLOYEE_ATTRIBUTES, raw: true }),
    db.shift.findAll({ raw: true, paranoid: false }),
    db.employeeShiftAssignment.findAll({
      where: {
        ...(employeeIds ? { employeeId: { [Op.in]: employeeIds } } : {}),
        effectiveFrom: { [Op.lte]: ctxTo },
        [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: ctxFrom } }],
      },
      order: [["effectiveFrom", "DESC"], ["Id", "DESC"]],
      raw: true,
    }),
    db.holiday.findAll({ raw: true }),
    db.leaveRequest.findAll({
      where: {
        ...(employeeIds ? { employeeId: { [Op.in]: employeeIds } } : {}),
        approvalStatus: "Approved",
        startDate: { [Op.lte]: ctxTo },
        endDate: { [Op.gte]: ctxFrom },
      },
      include: [{ model: db.leaveType, as: "leaveType", attributes: ["Id", "name", "isPaid"], required: false }],
      order: [["Id", "ASC"]],
    }),
    db.attendancePunch.findAll({
      where: { punchDate: { [Op.between]: [addDays(ctxFrom, -1), addDays(ctxTo, 1)] } },
      attributes: ["employeePin", "employeeId", "punchDate", "punchClock"],
      raw: true,
    }),
  ]);

  return {
    employees,
    shiftById: new Map(shifts.map((shift) => [Number(shift.Id), shift])),
    assignments,
    holidays: holidays
      .filter(isActiveRecord)
      .map((holiday) => ({ ...holiday, ...holidayRange(holiday) }))
      .filter((holiday) => holiday.from && holiday.from <= ctxTo && holiday.to >= ctxFrom),
    leaves: leaves.map((leave) => leave.get({ plain: true })),
    punches,
  };
};

// Punches of one employee as minutes relative to `base` midnight.
const collectPunches = (employee, pinOwners, punches, base) => {
  const pin = employeePin(employee);
  const ownsPin = pin && pinOwners.get(pin)?.includes(employee.Id);
  return punches
    .filter(
      (punch) =>
        (punch.employeeId && Number(punch.employeeId) === Number(employee.Id)) ||
        (!punch.employeeId && ownsPin && String(punch.employeePin || "").trim() === pin),
    )
    .map((punch) => {
      const clock = String(punch.punchClock || "");
      return {
        minutes: dayDiff(base, punch.punchDate) * 1440 + clockToMinutes(clock),
        seconds: Number(clock.slice(6, 8)) || 0,
      };
    })
    .filter((punch) => Number.isFinite(punch.minutes))
    .sort((a, b) => a.minutes - b.minutes || a.seconds - b.seconds);
};

const resolveShift = ({ employee, date, assignments, shiftById, policy }) => {
  const assignment = assignments.find(
    (row) =>
      Number(row.employeeId) === Number(employee.Id) &&
      row.effectiveFrom <= date &&
      (!row.effectiveTo || row.effectiveTo >= date),
  );
  const shiftId = assignment?.shiftId || employee.shiftId || policy.defaultShiftId || null;
  const baseShift = shiftId ? shiftById.get(Number(shiftId)) : null;
  // The assignment's own office time / grace win over the shift's.
  const own = (key) => assignment && assignment[key] !== null && assignment[key] !== undefined && assignment[key] !== "";
  const shiftRow = baseShift && {
    ...baseShift,
    ...(own("startTime") ? { startTime: assignment.startTime } : {}),
    ...(own("endTime") ? { endTime: assignment.endTime } : {}),
    ...(own("graceInMinutes") ? { graceInMinutes: assignment.graceInMinutes } : {}),
    ...(own("graceOutMinutes") ? { graceOutMinutes: assignment.graceOutMinutes } : {}),
  };
  if (!shiftRow) {
    return { shift: null, weeklyOffDays: normalizeWeekdays(assignment?.weeklyOffDays ?? policy.defaultWeeklyOffDays) };
  }
  const shift = normalizeShift(shiftRow, assignment?.weeklyOffDays);
  return { shift, weeklyOffDays: shift.weeklyOffDays };
};

const findLeave = (leaves, employee, date) => {
  const matches = leaves.filter(
    (leave) =>
      Number(leave.employeeId) === Number(employee.Id) &&
      String(leave.startDate).slice(0, 10) <= date &&
      String(leave.endDate).slice(0, 10) >= date,
  );
  if (!matches.length) return null;
  const leave = matches.find((row) => !row.isHalfDay) || matches[0];
  return {
    Id: leave.Id,
    leaveTypeId: leave.leaveTypeId,
    isPaid: leave.leaveType ? leave.leaveType.isPaid !== false : true,
    isHalfDay: Boolean(leave.isHalfDay),
    typeName: leave.leaveType?.name || null,
  };
};

// Results for one employee over [ctxFrom, ctxTo]; null = no row that day.
const evaluateEmployee = ({ employee, context, policy, ctxFrom, ctxTo, today, nowMinutes, pinOwners }) => {
  const base = addDays(ctxFrom, -1);
  const punches = collectPunches(employee, pinOwners, context.punches, base);
  const joining = employee.joiningDate ? String(employee.joiningDate).slice(0, 10) : null;
  const exit = employee.exitDate ? String(employee.exitDate).slice(0, 10) : null;

  const days = dateRange(ctxFrom, ctxTo).map((date) => {
    if ((joining && date < joining) || (exit && date > exit)) return { date, result: null };

    const { shift, weeklyOffDays } = resolveShift({ employee, date, ...context, policy });
    const offset = dayDiff(base, date) * 1440;
    const window = punchWindow(shift);
    const dayPunches = punches
      .filter((punch) => punch.minutes >= offset + window.from && punch.minutes < offset + window.to)
      .map((punch) => ({ minutes: punch.minutes - offset, seconds: punch.seconds }));
    const holiday = context.holidays.find(
      (row) => row.from <= date && row.to >= date && holidayAppliesTo(row, employee),
    );

    const result = evaluateDay({
      date,
      today,
      nowMinutes,
      shift,
      holiday: holiday ? { Id: holiday.Id, name: holiday.name } : null,
      isWeeklyOff: weeklyOffDays.includes(weekdayName(date)),
      leave: findLeave(context.leaves, employee, date),
      punches: dayPunches,
      policy,
    });
    return { date, result };
  });

  return policy.sandwichRule ? applySandwichRule(days) : days;
};

// pin → [employeeId] for tracked employees (a PIN shared by two employees
// is credited to both and flagged on the Attendance Setup page).
const buildPinOwners = (employees) => {
  const owners = new Map();
  employees.forEach((employee) => {
    const pin = employeePin(employee);
    if (!pin) return;
    if (!owners.has(pin)) owners.set(pin, []);
    owners.get(pin).push(employee.Id);
  });
  return owners;
};

const computeRange = async ({ from, to, employeeIds = null } = {}) => {
  const policy = await getPolicy();
  const today = bdToday();
  const start = maxYmd(from || today, policy.trackFromDate);
  const end = minYmd(to || today, today);
  if (!start || !end || start > end) return { from: start, to: end, employees: 0, rows: 0, skipped: true };

  const ids = Array.isArray(employeeIds) && employeeIds.length ? employeeIds.map(Number) : null;
  const ctxFrom = policy.sandwichRule ? maxYmd(addDays(start, -SANDWICH_CONTEXT_DAYS), policy.trackFromDate) : start;
  const ctxTo = policy.sandwichRule ? minYmd(addDays(end, SANDWICH_CONTEXT_DAYS), today) : end;

  // All employees are loaded for the PIN map even when only some are
  // recomputed, so a shared PIN is detected the same way every time.
  const context = await loadContext({ ctxFrom, ctxTo, employeeIds: null });
  const tracked = context.employees.filter(isTrackedEmployee);
  const pinOwners = buildPinOwners(tracked);
  const targets = ids ? tracked.filter((employee) => ids.includes(Number(employee.Id))) : tracked;
  const exempt = context.employees
    .filter((employee) => employee.attendanceExempt && (!ids || ids.includes(Number(employee.Id))))
    .map((employee) => employee.Id);

  const lockedRows = await db.attendanceDay.findAll({
    where: {
      attendanceDate: { [Op.between]: [start, end] },
      isLocked: true,
      ...(ids ? { employeeId: { [Op.in]: ids } } : {}),
    },
    attributes: ["employeeId", "attendanceDate"],
    raw: true,
  });
  const locked = new Set(lockedRows.map((row) => `${row.employeeId}|${row.attendanceDate}`));

  const nowMinutes = bdNowMinutes();
  const computedAt = new Date();
  const upserts = [];
  const removals = [];

  targets.forEach((employee) => {
    const days = evaluateEmployee({ employee, context, policy, ctxFrom, ctxTo, today, nowMinutes, pinOwners });
    days.forEach(({ date, result }) => {
      if (date < start || date > end || locked.has(`${employee.Id}|${date}`)) return;
      if (!result) {
        removals.push({ employeeId: employee.Id, attendanceDate: date });
        return;
      }
      upserts.push({ employeeId: employee.Id, attendanceDate: date, ...result, source: "auto", computedAt });
    });
  });

  await db.sequelize.transaction(async (transaction) => {
    for (let i = 0; i < upserts.length; i += 500) {
      await db.attendanceDay.bulkCreate(upserts.slice(i, i + 500), {
        updateOnDuplicate: [...WRITE_FIELDS, "updatedAt"],
        transaction,
      });
    }
    if (removals.length) {
      const byEmployee = removals.reduce((acc, row) => {
        (acc[row.employeeId] = acc[row.employeeId] || []).push(row.attendanceDate);
        return acc;
      }, {});
      for (const [employeeId, dates] of Object.entries(byEmployee)) {
        await db.attendanceDay.destroy({
          where: { employeeId, attendanceDate: { [Op.in]: dates }, isLocked: false },
          transaction,
        });
      }
    }
    if (exempt.length) {
      await db.attendanceDay.destroy({
        where: {
          employeeId: { [Op.in]: exempt },
          attendanceDate: { [Op.between]: [start, end] },
          isLocked: false,
        },
        transaction,
      });
    }
  });

  return { from: start, to: end, employees: targets.length, rows: upserts.length, removed: removals.length };
};

module.exports = { computeRange, employeePin, isTrackedEmployee, buildPinOwners };

// Pure attendance rules: given one employee-day's shift, off-day/leave
// context and punches, decide the status and minutes. No database access —
// attendance.engine.js gathers the inputs and writes the result.
//
// Status precedence for a day:
//   Holiday → Weekly Off → approved Leave (full) → punches → Absent
// A half-day leave covers half the day; the other half is judged by punches.

const { clockToMinutes, minutesToClock, normalizeWeekdays, addDays } = require("./attendance.time");

// How far around a night shift's start/end a punch still belongs to it.
const NIGHT_IN_WINDOW_MINUTES = 4 * 60;
const NIGHT_OUT_WINDOW_MINUTES = 6 * 60;
// Break is only deducted from a stay at least this much longer than it.
const BREAK_MIN_EXTRA_MINUTES = 4 * 60;

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// Shift row (+ optional weekly-off override) → the numbers the rules use.
// end is pushed past midnight (> 1440) for a shift that crosses it.
const normalizeShift = (shift, weeklyOffOverride) => {
  if (!shift) return null;
  const start = clockToMinutes(shift.startTime);
  let end = clockToMinutes(shift.endTime);
  const crossesMidnight = start !== null && end !== null && end <= start;
  if (crossesMidnight) end += 1440;
  const weeklyOffDays = normalizeWeekdays(
    weeklyOffOverride !== null && weeklyOffOverride !== undefined ? weeklyOffOverride : shift.weeklyOffDays,
  );
  return {
    id: shift.Id ?? shift.id ?? null,
    name: shift.name || null,
    hasTiming: start !== null && end !== null,
    start,
    end,
    startClock: start !== null ? minutesToClock(start) : null,
    endClock: end !== null ? minutesToClock(end) : null,
    crossesMidnight,
    graceIn: num(shift.graceInMinutes),
    graceOut: num(shift.graceOutMinutes),
    breakMinutes: num(shift.breakMinutes),
    fullDayMinutes: num(shift.fullDayMinutes),
    halfDayMinutes: num(shift.halfDayMinutes),
    otStartAfter: num(shift.overtimeStartAfterMinutes),
    minOt: num(shift.minimumOvertimeMinutes),
    weeklyOffDays,
  };
};

// [from, to) in minutes relative to the day's midnight: punches inside belong
// to this attendance date. Day shifts take the calendar day; night shifts
// reach into the next morning.
const punchWindow = (shift) => {
  if (!shift || !shift.hasTiming || !shift.crossesMidnight) return { from: 0, to: 1440 };
  const from = shift.start - NIGHT_IN_WINDOW_MINUTES;
  const nextDayFrom = 1440 + shift.start - NIGHT_IN_WINDOW_MINUTES;
  return { from, to: Math.min(shift.end + NIGHT_OUT_WINDOW_MINUTES, nextDayFrom) };
};

// Minutes relative to the day's midnight → "YYYY-MM-DD HH:MM:SS".
const formatLocal = (date, minutes, seconds = 0) => {
  const dayOffset = Math.floor(minutes / 1440);
  const day = dayOffset ? addDays(date, dayOffset) : date;
  return `${day} ${minutesToClock(minutes)}:${String(seconds).padStart(2, "0")}`;
};

const EMPTY = {
  inTime: null,
  outTime: null,
  punchCount: 0,
  workedMinutes: 0,
  lateMinutes: 0,
  earlyLeaveMinutes: 0,
  overtimeMinutes: 0,
  isLate: false,
  isEarlyLeave: false,
  isMissingPunch: false,
  workedOnOffDay: false,
  presentValue: 0,
  absentValue: 0,
  leaveValue: 0,
};

// punches: [{ minutes, seconds }] relative to the day's midnight, sorted.
const measurePunches = (date, punches, shift, policy) => {
  if (!punches.length) return null;
  const first = punches[0];
  const last = punches[punches.length - 1];
  const span = last.minutes - first.minutes;
  const single = span < Math.max(num(policy.duplicatePunchMinutes, 2), 1);

  let worked = 0;
  if (!single) {
    const breakMinutes = shift?.breakMinutes || 0;
    worked = span >= breakMinutes + BREAK_MIN_EXTRA_MINUTES ? span - breakMinutes : span;
  }

  return {
    first: first.minutes,
    last: single ? null : last.minutes,
    single,
    worked,
    inTime: formatLocal(date, first.minutes, first.seconds),
    outTime: single ? null : formatLocal(date, last.minutes, last.seconds),
    punchCount: punches.length,
  };
};

const lateness = (measure, shift) => {
  if (!measure || !shift?.hasTiming) return 0;
  return measure.first > shift.start + shift.graceIn ? measure.first - shift.start : 0;
};

const earliness = (measure, shift) => {
  if (!measure || measure.last === null || !shift?.hasTiming) return 0;
  return measure.last < shift.end - shift.graceOut ? shift.end - measure.last : 0;
};

const overtime = (measure, shift, policy) => {
  if (!policy.overtimeEnabled || !measure || measure.last === null || !shift?.hasTiming) return 0;
  const extra = measure.last - shift.end;
  if (extra <= 0 || extra < shift.otStartAfter || extra < shift.minOt) return 0;
  return extra;
};

// Status of the punched part of a working day: { status, present, absent }.
// `share` is the part of the day still to be earned (1, or 0.5 beside a
// half-day leave).
const judgePunches = ({ measure, shift, policy, dayOver, share }) => {
  if (!dayOver) return { status: "Present", present: share, absent: 0, missing: false };

  if (measure.single) {
    const rule = policy.singlePunchAs || "Present";
    if (rule === "Absent") return { status: "Absent", present: 0, absent: share, missing: true };
    if (rule === "Half Day" && share === 1) {
      return { status: "Half Day", present: 0.5, absent: 0.5, missing: true };
    }
    return { status: "Present", present: share, absent: 0, missing: true };
  }

  const halfMin = (shift?.halfDayMinutes || 0) * share;
  const fullMin = (shift?.fullDayMinutes || 0) * share;
  if (halfMin && measure.worked < halfMin) {
    return { status: "Absent", present: 0, absent: share, missing: false };
  }
  if (fullMin && measure.worked < fullMin && share === 1) {
    return { status: "Half Day", present: 0.5, absent: 0.5, missing: false };
  }
  return { status: "Present", present: share, absent: 0, missing: false };
};

// The day's result, or null when nothing should be stored (a future date).
//   ctx.date / ctx.today: "YYYY-MM-DD"; ctx.nowMinutes: now, Bangladesh time
//   ctx.shift: normalizeShift() result or null
//   ctx.holiday: { Id, name } | null; ctx.isWeeklyOff: boolean
//   ctx.leave: { Id, leaveTypeId, isPaid, isHalfDay, typeName } | null
//   ctx.punches: [{ minutes, seconds }] within punchWindow(), sorted
//   ctx.policy: attendance policy
const evaluateDay = (ctx) => {
  const { date, today, nowMinutes, shift, holiday, isWeeklyOff, leave, punches, policy } = ctx;
  if (date > today) return null;

  const isToday = date === today;
  const measure = measurePunches(date, punches || [], shift, policy);
  const remarks = [];
  const base = {
    ...EMPTY,
    shiftId: shift?.id || null,
    shiftStart: shift?.startClock || null,
    shiftEnd: shift?.endClock || null,
    holidayId: null,
    leaveRequestId: null,
    leaveTypeId: null,
    leaveIsPaid: null,
  };
  if (measure) {
    base.inTime = measure.inTime;
    base.outTime = measure.outTime;
    base.punchCount = measure.punchCount;
    base.workedMinutes = measure.worked;
  }

  // Off days: no late/early, worked time optionally counted as overtime.
  if (holiday || isWeeklyOff) {
    const result = {
      ...base,
      status: holiday ? "Holiday" : "Weekly Off",
      holidayId: holiday?.Id || null,
      workedOnOffDay: Boolean(measure),
    };
    if (holiday) remarks.push(holiday.name);
    if (measure) {
      remarks.push("Worked on off day");
      if (policy.overtimeEnabled && policy.offDayWorkAsOvertime) result.overtimeMinutes = measure.worked;
    }
    result.remarks = remarks.join(" | ") || null;
    return result;
  }

  const leaveFields = leave
    ? {
        leaveRequestId: leave.Id,
        leaveTypeId: leave.leaveTypeId || null,
        leaveIsPaid: leave.isPaid !== false,
      }
    : {};

  if (leave && !leave.isHalfDay) {
    if (leave.typeName) remarks.push(leave.typeName);
    if (measure) remarks.push("Punched while on leave");
    return {
      ...base,
      ...leaveFields,
      status: "Leave",
      leaveValue: 1,
      remarks: remarks.join(" | ") || null,
    };
  }

  const share = leave ? 0.5 : 1;
  const shiftEnded = shift?.hasTiming ? nowMinutes >= shift.end + shift.graceOut : false;
  const dayOver = !isToday || shiftEnded;
  if (leave) remarks.push(`Half-day leave${leave.typeName ? ` (${leave.typeName})` : ""}`);

  if (!measure) {
    // Today, before the shift has properly started: not absent yet.
    const notStarted = isToday && (!shift?.hasTiming || nowMinutes < shift.start + shift.graceIn);
    if (notStarted) {
      return {
        ...base,
        ...leaveFields,
        status: leave ? "Half Leave" : "Pending",
        leaveValue: leave ? 0.5 : 0,
        remarks: remarks.join(" | ") || null,
      };
    }
    return {
      ...base,
      ...leaveFields,
      status: leave ? "Half Leave" : "Absent",
      absentValue: share,
      leaveValue: leave ? 0.5 : 0,
      remarks: remarks.join(" | ") || null,
    };
  }

  const judged = judgePunches({ measure, shift, policy, dayOver, share });
  const lateMinutes = lateness(measure, shift);
  const earlyLeaveMinutes = dayOver ? earliness(measure, shift) : 0;
  if (judged.missing) remarks.push("Missing out punch");

  return {
    ...base,
    ...leaveFields,
    status: leave ? "Half Leave" : judged.status,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes: overtime(measure, shift, policy),
    isLate: lateMinutes > 0,
    isEarlyLeave: earlyLeaveMinutes > 0,
    isMissingPunch: judged.missing,
    presentValue: judged.present,
    absentValue: judged.absent,
    leaveValue: leave ? 0.5 : 0,
    remarks: remarks.join(" | ") || null,
  };
};

const isOffStatus = (status) => status === "Holiday" || status === "Weekly Off";

// Sandwich rule over one employee's consecutive days ([{ date, result }],
// sorted): an off day (not worked) whose nearest working days on both sides
// are full-day absences becomes Absent. Days outside the list are unknown, so
// an off run at either edge is left alone.
const applySandwichRule = (days) => {
  const isFullAbsent = (result) => result && result.status === "Absent" && Number(result.absentValue) >= 1;
  for (let i = 0; i < days.length; i += 1) {
    const current = days[i].result;
    if (!current || !isOffStatus(current.status) || current.workedOnOffDay) continue;

    let prev = i - 1;
    while (prev >= 0 && days[prev].result && isOffStatus(days[prev].result.status)) prev -= 1;
    let next = i + 1;
    while (next < days.length && days[next].result && isOffStatus(days[next].result.status)) next += 1;
    if (prev < 0 || next >= days.length) continue;
    if (!isFullAbsent(days[prev].result) || !isFullAbsent(days[next].result)) continue;

    days[i].result = {
      ...current,
      status: "Absent",
      absentValue: 1,
      remarks: [current.remarks, "Sandwich rule"].filter(Boolean).join(" | "),
    };
  }
  return days;
};

module.exports = {
  normalizeShift,
  punchWindow,
  evaluateDay,
  applySandwichRule,
  isOffStatus,
};

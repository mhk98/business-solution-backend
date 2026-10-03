const db = require("../../../models");
const { bdToday, isYmd, normalizeWeekdays } = require("./attendance.time");

const POLICY_ID = 1;
const SINGLE_PUNCH_RULES = ["Present", "Half Day", "Absent"];
const CACHE_MS = 30 * 1000;

let cached = null;
let cachedAt = 0;

const firstPunchDate = async () => {
  const row = await db.attendancePunch.findOne({
    attributes: ["punchDate"],
    order: [["punchDate", "ASC"]],
    raw: true,
  });
  return row?.punchDate || null;
};

// The single policy row; created on first use with tracking starting at the
// first punch the device ever sent (or today).
const getPolicy = async ({ fresh = false } = {}) => {
  if (!fresh && cached && Date.now() - cachedAt < CACHE_MS) return cached;
  let row = await db.attendancePolicy.findByPk(POLICY_ID);
  if (!row) {
    row = await db.attendancePolicy.create({
      Id: POLICY_ID,
      trackFromDate: (await firstPunchDate()) || bdToday(),
      // Weekly off is whatever is set per shift / employee — nothing implied.
      defaultWeeklyOffDays: [],
    });
  }
  cached = row.get({ plain: true });
  cachedAt = Date.now();
  return cached;
};

const toInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

const updatePolicy = async (payload = {}, user = {}) => {
  const current = await getPolicy({ fresh: true });
  const patch = { updatedByUserId: user.Id || null };

  if (payload.trackFromDate !== undefined) {
    patch.trackFromDate = isYmd(payload.trackFromDate) ? payload.trackFromDate : current.trackFromDate;
  }
  if (payload.defaultShiftId !== undefined) {
    patch.defaultShiftId = payload.defaultShiftId ? Number(payload.defaultShiftId) : null;
  }
  if (payload.defaultWeeklyOffDays !== undefined) {
    patch.defaultWeeklyOffDays = normalizeWeekdays(payload.defaultWeeklyOffDays);
  }
  if (payload.singlePunchAs !== undefined && SINGLE_PUNCH_RULES.includes(payload.singlePunchAs)) {
    patch.singlePunchAs = payload.singlePunchAs;
  }
  [
    ["duplicatePunchMinutes", 2],
    ["lateDaysPerAbsent", 0],
    ["earlyLeaveDaysPerAbsent", 0],
    ["recomputeDays", 7],
  ].forEach(([key, fallback]) => {
    if (payload[key] !== undefined) patch[key] = toInt(payload[key], fallback);
  });
  ["overtimeEnabled", "offDayWorkAsOvertime", "sandwichRule", "holidayWorkPaid", "weeklyOffWorkPaid"].forEach((key) => {
    if (payload[key] !== undefined) patch[key] = payload[key] === true || payload[key] === "true";
  });
  if (patch.recomputeDays !== undefined) patch.recomputeDays = Math.min(Math.max(patch.recomputeDays, 1), 62);

  await db.attendancePolicy.update(patch, { where: { Id: POLICY_ID } });
  cached = null;
  return getPolicy({ fresh: true });
};

module.exports = { getPolicy, updatePolicy, SINGLE_PUNCH_RULES };

const { Op, fn, col } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const User = db.user;
const UserLogHistory = db.userLogHistory;

const BUSINESS_TIMEZONE = "Asia/Dhaka";
const BUSINESS_UTC_OFFSET = "+06:00";

// Roles that are not expected to have daily operational activity.
const EXCLUDED_ROLES = ["superAdmin", "admin"];

// Write methods logged by the global userLogHistory middleware.
const WORK_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// Auth events are logged as POST but are not "work".
const NON_WORK_ACTIONS = ["login", "logout", "failed_login"];

const MAX_RANGE_DAYS = 400;

const VALID_VIEWS = new Set(["not_worked", "worked", "all"]);

const isValidDateString = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) &&
  !Number.isNaN(new Date(`${value}T00:00:00${BUSINESS_UTC_OFFSET}`).getTime());

const todayBusinessDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: BUSINESS_TIMEZONE });

const resolveBusinessDate = (date) => {
  if (date == null || date === "") return todayBusinessDate();
  if (!isValidDateString(date)) {
    throw new ApiError(400, "Invalid date. Use YYYY-MM-DD");
  }
  return String(date).slice(0, 10);
};

const businessDayBounds = (businessDate) => ({
  start: new Date(`${businessDate}T00:00:00.000${BUSINESS_UTC_OFFSET}`),
  end: new Date(`${businessDate}T23:59:59.999${BUSINESS_UTC_OFFSET}`),
});

// YYYY-MM-DD (Asia/Dhaka) for a JS Date / timestamp.
const toBusinessDate = (value) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: BUSINESS_TIMEZONE });

const enumerateDates = (startDate, endDate) => {
  const dates = [];
  let cursor = new Date(`${startDate}T12:00:00.000${BUSINESS_UTC_OFFSET}`);
  const last = new Date(`${endDate}T12:00:00.000${BUSINESS_UTC_OFFSET}`);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(toBusinessDate(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
};

const workLogWhere = (extra = {}) => ({
  userId: { [Op.ne]: null },
  method: { [Op.in]: WORK_METHODS },
  action: { [Op.notIn]: NON_WORK_ACTIONS },
  ...extra,
});

const formatUser = (user) => {
  const email = (user.Email || "").trim();
  const fullName = [user.FirstName, user.LastName]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    Id: user.Id,
    name: fullName || email || "-",
    Email: email || null,
    Phone: (user.Phone || "").trim() || null,
    role: user.role || null,
  };
};

const getCandidateUsers = async () => {
  const rows = await User.findAll({
    attributes: ["Id", "FirstName", "LastName", "Email", "Phone", "role"],
    where: { role: { [Op.notIn]: EXCLUDED_ROLES }, status: "Active" },
    order: [
      ["role", "ASC"],
      ["FirstName", "ASC"],
      ["LastName", "ASC"],
    ],
    raw: true,
  });
  return rows.map((row) => ({ ...formatUser(row), _raw: row }));
};

const getWorkedUserIds = async ({ start, end }) => {
  const rows = await UserLogHistory.findAll({
    attributes: [[fn("DISTINCT", col("userId")), "userId"]],
    where: workLogWhere({ createdAt: { [Op.between]: [start, end] } }),
    raw: true,
  });
  return new Set(
    rows.map((row) => Number(row.userId)).filter((id) => Number.isFinite(id)),
  );
};

const getActivityCountMap = async (userIds, { start, end }) => {
  if (!userIds.length) return new Map();
  const rows = await UserLogHistory.findAll({
    attributes: ["userId", [fn("COUNT", col("Id")), "count"]],
    where: workLogWhere({
      userId: { [Op.in]: userIds },
      createdAt: { [Op.between]: [start, end] },
    }),
    group: ["userId"],
    raw: true,
  });
  return new Map(rows.map((row) => [Number(row.userId), Number(row.count)]));
};

const getLastActivityMap = async (userIds) => {
  if (!userIds.length) return new Map();
  const rows = await UserLogHistory.findAll({
    attributes: ["userId", [fn("MAX", col("createdAt")), "lastActivityAt"]],
    where: workLogWhere({ userId: { [Op.in]: userIds } }),
    group: ["userId"],
    raw: true,
  });
  return new Map(
    rows.map((row) => [Number(row.userId), row.lastActivityAt || null]),
  );
};

// userId -> Set of business-date strings the user had >=1 work action on.
const getWorkedDatesByUser = async ({ start, end }) => {
  const rows = await UserLogHistory.findAll({
    attributes: ["userId", "createdAt"],
    where: workLogWhere({ createdAt: { [Op.between]: [start, end] } }),
    raw: true,
  });
  const map = new Map();
  rows.forEach((row) => {
    const id = Number(row.userId);
    if (!Number.isFinite(id)) return;
    if (!map.has(id)) map.set(id, new Set());
    map.get(id).add(toBusinessDate(row.createdAt));
  });
  return map;
};

// ── Day mode ──────────────────────────────────────────────
const getDayReport = async ({ date, view, userId }) => {
  const businessDate = resolveBusinessDate(date);
  const bounds = businessDayBounds(businessDate);

  let candidates = await getCandidateUsers();
  if (userId) {
    candidates = candidates.filter((user) => Number(user.Id) === Number(userId));
  }

  const workedIds = await getWorkedUserIds(bounds);
  const workedCount = candidates.filter((user) =>
    workedIds.has(Number(user.Id)),
  ).length;

  let selected = candidates;
  if (view === "not_worked") {
    selected = candidates.filter((user) => !workedIds.has(Number(user.Id)));
  } else if (view === "worked") {
    selected = candidates.filter((user) => workedIds.has(Number(user.Id)));
  }

  const selectedIds = selected.map((user) => Number(user.Id));
  const [lastActivityMap, activityCountMap] = await Promise.all([
    getLastActivityMap(selectedIds),
    getActivityCountMap(selectedIds, bounds),
  ]);

  const data = selected.map((user) => ({
    Id: user.Id,
    name: user.name,
    Email: user.Email,
    Phone: user.Phone,
    role: user.role,
    worked: workedIds.has(Number(user.Id)),
    activityCount: activityCountMap.get(Number(user.Id)) || 0,
    lastActivityAt: lastActivityMap.get(Number(user.Id)) || null,
  }));

  return {
    mode: "day",
    meta: {
      date: businessDate,
      timezone: BUSINESS_TIMEZONE,
      view,
      totalConsidered: candidates.length,
      workedCount,
      notWorkedCount: candidates.length - workedCount,
    },
    users: candidates.map(({ Id, name, Email, role }) => ({
      Id,
      name,
      Email,
      role,
    })),
    data,
  };
};

// ── Range mode (all users) ────────────────────────────────
const getRangeReport = async ({ startDate, endDate }) => {
  const start = resolveBusinessDate(startDate);
  const end = resolveBusinessDate(endDate);
  if (start > end) {
    throw new ApiError(400, "startDate must be on or before endDate");
  }

  const days = enumerateDates(start, end);
  if (days.length > MAX_RANGE_DAYS) {
    throw new ApiError(400, `Date range too large (max ${MAX_RANGE_DAYS} days)`);
  }

  const candidates = await getCandidateUsers();
  const rangeBounds = {
    start: businessDayBounds(start).start,
    end: businessDayBounds(end).end,
  };
  const workedDatesByUser = await getWorkedDatesByUser(rangeBounds);

  const data = candidates.map((user) => {
    const workedSet = workedDatesByUser.get(Number(user.Id)) || new Set();
    const daysWorked = days.reduce(
      (count, day) => count + (workedSet.has(day) ? 1 : 0),
      0,
    );
    return {
      Id: user.Id,
      name: user.name,
      Email: user.Email,
      role: user.role,
      daysWorked,
      daysNotWorked: days.length - daysWorked,
      totalDays: days.length,
    };
  });

  return {
    mode: "range",
    meta: {
      startDate: start,
      endDate: end,
      timezone: BUSINESS_TIMEZONE,
      totalDays: days.length,
      totalConsidered: candidates.length,
    },
    users: candidates.map(({ Id, name, Email, role }) => ({
      Id,
      name,
      Email,
      role,
    })),
    data,
  };
};

// ── Range mode (single user, day-by-day) ──────────────────
const getRangeUserReport = async ({ startDate, endDate, userId }) => {
  const start = resolveBusinessDate(startDate);
  const end = resolveBusinessDate(endDate);
  if (start > end) {
    throw new ApiError(400, "startDate must be on or before endDate");
  }

  const days = enumerateDates(start, end);
  if (days.length > MAX_RANGE_DAYS) {
    throw new ApiError(400, `Date range too large (max ${MAX_RANGE_DAYS} days)`);
  }

  const user = await User.findOne({
    attributes: ["Id", "FirstName", "LastName", "Email", "Phone", "role"],
    where: { Id: userId },
    raw: true,
  });
  if (!user) throw new ApiError(404, "User not found");

  const rows = await UserLogHistory.findAll({
    attributes: ["createdAt"],
    where: workLogWhere({
      userId,
      createdAt: {
        [Op.between]: [
          businessDayBounds(start).start,
          businessDayBounds(end).end,
        ],
      },
    }),
    raw: true,
  });

  const countByDate = new Map();
  rows.forEach((row) => {
    const day = toBusinessDate(row.createdAt);
    countByDate.set(day, (countByDate.get(day) || 0) + 1);
  });

  const data = days.map((day) => ({
    date: day,
    worked: (countByDate.get(day) || 0) > 0,
    activityCount: countByDate.get(day) || 0,
  }));
  const daysWorked = data.filter((row) => row.worked).length;

  return {
    mode: "range_user",
    meta: {
      startDate: start,
      endDate: end,
      timezone: BUSINESS_TIMEZONE,
      userId: Number(userId),
      name: formatUser(user).name,
      role: user.role || null,
      totalDays: days.length,
      daysWorked,
      daysNotWorked: days.length - daysWorked,
    },
    data,
  };
};

// ── Public entry: routes by params ───────────────────────
const getReport = async (query = {}) => {
  const { startDate, endDate, userId } = query;
  const view = VALID_VIEWS.has(query.view) ? query.view : "not_worked";
  const hasRange = Boolean(startDate) && Boolean(endDate);

  if (hasRange && userId) {
    return getRangeUserReport({ startDate, endDate, userId });
  }
  if (hasRange) {
    return getRangeReport({ startDate, endDate });
  }
  return getDayReport({ date: query.date, view, userId });
};

// ── A single user's full activity log for one business day ─
const getUserDayActivity = async ({ userId, date }) => {
  if (!userId) throw new ApiError(400, "userId is required");
  const businessDate = resolveBusinessDate(date);
  const bounds = businessDayBounds(businessDate);

  const user = await User.findOne({
    attributes: ["Id", "FirstName", "LastName", "Email", "role"],
    where: { Id: userId },
    raw: true,
  });
  if (!user) throw new ApiError(404, "User not found");

  const rows = await UserLogHistory.findAll({
    attributes: [
      "Id",
      "createdAt",
      "action",
      "module",
      "method",
      "route",
      "statusCode",
      "status",
      "responseMessage",
    ],
    where: {
      userId,
      createdAt: { [Op.between]: [bounds.start, bounds.end] },
    },
    order: [["createdAt", "ASC"]],
    raw: true,
  });

  const workCount = rows.filter(
    (row) =>
      WORK_METHODS.includes(row.method) &&
      !NON_WORK_ACTIONS.includes(row.action),
  ).length;

  return {
    meta: {
      userId: Number(userId),
      name: formatUser(user).name,
      role: user.role || null,
      date: businessDate,
      timezone: BUSINESS_TIMEZONE,
      total: rows.length,
      workCount,
    },
    data: rows.map((row) => ({
      Id: row.Id,
      createdAt: row.createdAt,
      action: row.action,
      module: row.module,
      method: row.method,
      route: row.route,
      statusCode: row.statusCode,
      status: row.status,
      responseMessage: row.responseMessage,
      isWork:
        WORK_METHODS.includes(row.method) &&
        !NON_WORK_ACTIONS.includes(row.action),
    })),
  };
};

module.exports = {
  // kept for backward compatibility with the original route name
  getTodayNotWorked: getReport,
  getReport,
  getUserDayActivity,
};

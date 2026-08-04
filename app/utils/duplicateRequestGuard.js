const db = require("../../models");
const { sanitizeValue } = require("./userLogHistory");
const { Op } = require("sequelize");

const DUPLICATE_WINDOW_MINUTES = 5;
const DUPLICATE_WINDOW_MS = DUPLICATE_WINDOW_MINUTES * 60 * 1000;
const IGNORED_ROUTE_SEGMENTS = [
  "login",
  "register",
  "refresh-token",
  "logout",
  "verify",
  "forgot",
  "reset",
];

const duplicateRequestLocks = new Map();

const sortObjectKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortObjectKeys(value[key]);
        return sorted;
      }, {});
  }

  return value;
};

const stableStringify = (value) => {
  return JSON.stringify(sortObjectKeys(value));
};

const getRouteTemplate = (req) => {
  const baseUrl = req.baseUrl || "";
  const routePath = req.route?.path || req.path || req.originalUrl || "";
  return `${baseUrl}${routePath}`;
};

const isIgnoredRoute = (req) => {
  const template = getRouteTemplate(req).toLowerCase();
  return IGNORED_ROUTE_SEGMENTS.some((segment) => template.includes(segment));
};

const buildRequestFingerprint = (req) => {
  const sanitized = sanitizeValue(req.body || {});
  if (sanitized === undefined || sanitized === null) return null;

  return stableStringify({
    route: getRouteTemplate(req),
    method: req.method,
    body: sanitized,
  });
};

const buildDuplicateKey = (req) => {
  const fingerprint = buildRequestFingerprint(req);
  if (!fingerprint || fingerprint === "{}") return null;

  const userId = req.user?.Id || req.user?.userId;
  if (!userId) return null;

  return `${userId}:${fingerprint}`;
};

const cleanupPendingRequest = (key) => {
  if (!duplicateRequestLocks.has(key)) return;
  const timer = duplicateRequestLocks.get(key);
  clearTimeout(timer);
  duplicateRequestLocks.delete(key);
};

const holdDuplicateLock = (key) => {
  cleanupPendingRequest(key);

  const timer = setTimeout(
    () => cleanupPendingRequest(key),
    DUPLICATE_WINDOW_MS,
  );
  duplicateRequestLocks.set(key, timer);
};

const registerPendingRequest = (req, res) => {
  if (!req.user || req.method !== "POST") return;
  if (isIgnoredRoute(req)) return;

  const key = buildDuplicateKey(req);
  if (!key) return;

  if (duplicateRequestLocks.has(key)) return;

  holdDuplicateLock(key);

  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      holdDuplicateLock(key);
      return;
    }

    cleanupPendingRequest(key);
  });
  res.on("close", () => {
    if (!res.writableEnded) cleanupPendingRequest(key);
  });
};

const hasDuplicateRequest = async (req) => {
  if (!req.user || req.method !== "POST") return false;
  if (isIgnoredRoute(req)) return false;

  const key = buildDuplicateKey(req);
  if (!key) return false;
  if (duplicateRequestLocks.has(key)) return true;

  const userId = req.user.Id || req.user.userId;
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  const recentRows = await db.userLogHistory.findAll({
    where: {
      userId,
      route: getRouteTemplate(req),
      method: req.method,
      statusCode: { [Op.gte]: 200, [Op.lt]: 400 },
      createdAt: { [Op.gte]: since },
    },
    order: [["createdAt", "DESC"]],
    limit: 20,
  });

  return recentRows.some((row) => {
    try {
      const recordedBody = row.requestBody || {};
      const recordedFingerprint = stableStringify({
        route: getRouteTemplate(req),
        method: req.method,
        body: sortObjectKeys(recordedBody),
      });
      return recordedFingerprint === key.split(":").slice(1).join(":");
    } catch (error) {
      return false;
    }
  });
};

module.exports = {
  hasDuplicateRequest,
  registerPendingRequest,
  DUPLICATE_WINDOW_MINUTES,
};

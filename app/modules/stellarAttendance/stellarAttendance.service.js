const axios = require("axios");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");

const JSON_API_URL = "https://rumytechnologies.com/rams/json_api";
const GPS_LOG_URL = "https://rumytechnologies.com/rams/service/get_gps_log";
const DEFAULT_ACCESS_ID = process.env.STELLAR_ATTENDANCE_DEFAULT_ACCESS_ID ?? 122790737;
const CACHE_TTL_MS = Number(process.env.STELLAR_ATTENDANCE_CACHE_TTL_MS || 5 * 60 * 1000);
const CHUNK_CONCURRENCY = Math.max(
  1,
  Number(process.env.STELLAR_ATTENDANCE_CHUNK_CONCURRENCY || 5),
);
const responseCache = new Map();
const StellarAttendanceLog = db.stellarAttendanceLog;
const StellarAttendanceSyncState = db.stellarAttendanceSyncState;

const getCredentials = () => {
  const authUser = process.env.STELLAR_AUTH_USER;
  const authCode = process.env.STELLAR_AUTH_CODE;

  if (!authUser || !authCode) {
    throw new ApiError(500, "Stellar attendance credentials are not configured");
  }

  return { authUser, authCode };
};

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const isTime = (value) => /^\d{2}:\d{2}:\d{2}$/.test(String(value || ""));

const dateFromParts = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const parseDateOnly = (value) => {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDateOnly = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getDateSpanDays = (startDate, endDate) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  return Math.floor((end - start) / 86400000) + 1;
};

const buildTwoDayChunks = (request) => {
  const chunks = [];
  let cursor = parseDateOnly(request.start_date);
  const end = parseDateOnly(request.end_date);

  while (cursor <= end) {
    const chunkStart = new Date(cursor);
    const chunkEnd = addDays(chunkStart, 1) > end ? end : addDays(chunkStart, 1);
    chunks.push({
      ...request,
      start_date: formatDateOnly(chunkStart),
      end_date: formatDateOnly(chunkEnd),
    });
    cursor = addDays(chunkEnd, 1);
  }

  return chunks;
};

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    },
  );

  await Promise.all(workers);
  return results;
};

const normalizeRequest = (query = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = query.start_date || query.startDate || today;
  const endDate = query.end_date || query.endDate || startDate;
  const startTime = query.start_time || query.startTime || "00:00:01";
  const endTime = query.end_time || query.endTime || "23:59:59";
  const accessId = query.access_id || query.accessId || DEFAULT_ACCESS_ID;
  const includeGps =
    query.includeGps === true ||
    query.includeGps === "true" ||
    query.operation === "fetch_gps_log";

  if (!isDate(startDate) || !isDate(endDate)) {
    throw new ApiError(400, "start_date and end_date must be YYYY-MM-DD");
  }

  if (parseDateOnly(startDate) > parseDateOnly(endDate)) {
    throw new ApiError(400, "start_date cannot be after end_date");
  }

  if (!isTime(startTime) || !isTime(endTime)) {
    throw new ApiError(400, "start_time and end_time must be HH:mm:ss");
  }

  const request = {
    operation: includeGps ? "fetch_gps_log" : "fetch_log",
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
  };

  if (accessId !== undefined && accessId !== null && accessId !== "") {
    request.access_id = Number.isNaN(Number(accessId)) ? accessId : Number(accessId);
  }

  return request;
};

const shouldSyncFromQuery = (query = {}) =>
  query.sync === true || query.sync === "true" || query.forceSync === "true";

const getSyncKey = (request) =>
  JSON.stringify({
    operation: request.operation,
    start_date: request.start_date,
    end_date: request.end_date,
    start_time: request.start_time,
    end_time: request.end_time,
    access_id: request.access_id,
  });

const getSyncState = async (request) => {
  if (!StellarAttendanceSyncState) return null;
  const [state] = await StellarAttendanceSyncState.findOrCreate({
    where: { syncKey: getSyncKey(request) },
    defaults: {
      syncKey: getSyncKey(request),
      lastStatus: "never_synced",
    },
  });
  return state;
};

const buildSyncLockInfo = (state) => {
  const nextAllowedAt = state?.nextAllowedAt ? new Date(state.nextAllowedAt) : null;
  const now = new Date();
  return {
    lastSyncedAt: state?.lastSyncedAt || null,
    nextAllowedAt: state?.nextAllowedAt || null,
    waitSeconds:
      nextAllowedAt && nextAllowedAt > now
        ? Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 1000)
        : 0,
    lastStatus: state?.lastStatus || null,
    lastMessage: state?.lastMessage || null,
  };
};

const markSyncAttempt = async (state, status, message) => {
  if (!state) return null;
  const now = new Date();
  const nextAllowedAt = new Date(now.getTime() + CACHE_TTL_MS);
  await state.update({
    lastSyncedAt: now,
    nextAllowedAt,
    lastStatus: status,
    lastMessage: message,
  });
  return buildSyncLockInfo(state);
};

const normalizeRows = (rawResponse) => {
  if (Array.isArray(rawResponse?.log)) return rawResponse.log;
  if (Array.isArray(rawResponse?.data?.log)) return rawResponse.data.log;
  if (Array.isArray(rawResponse)) return rawResponse;
  return [];
};

const normalizeUsers = (rawResponse) => {
  const users = rawResponse?.user_list || rawResponse?.data?.user_list || [];
  if (!Array.isArray(users)) return [];

  return users.map((user) => ({
    name: user.username || user.user_name || "-",
    registration_id:
      user.registration_id ||
      user.registraton_id ||
      user.username_id ||
      "",
    phone: user.phone || "",
    raw: user,
  }));
};

const getRowValue = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const normalizeStellarDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return null;
  return dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
};

const normalizeStellarTime = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return `${String(match[1]).padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
};

const buildLogDateTime = (logDate, logTime) => {
  if (!logDate || !logTime) return null;
  const date = new Date(`${logDate}T${logTime}+06:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const mapLogRowForDB = (row) => {
  const accessId = getRowValue(row, ["access_id", "accessId"]);
  if (!accessId) return null;

  const logDate = normalizeStellarDate(
    getRowValue(row, [
      "access_date",
      "date",
      "log_date",
      "punch_date",
      "attendance_date",
    ]),
  );
  const logTime = normalizeStellarTime(
    getRowValue(row, [
      "access_time",
      "time",
      "log_time",
      "punch_time",
      "attendance_time",
    ]),
  );

  return {
    accessId: Number(accessId),
    registrationId: String(
      getRowValue(row, [
        "registration_id",
        "registraton_id",
        "deviceUserId",
        "user_id",
        "userid",
      ]) || "",
    ),
    logDate,
    logTime,
    logDateTime: buildLogDateTime(logDate, logTime),
    deviceName: getRowValue(row, ["device_name", "deviceName", "device"]),
    deviceId: getRowValue(row, ["device_id", "deviceId", "serial_number"]),
    card: getRowValue(row, ["card", "card_no", "cardNo"]),
    rawPayload: row,
    lastSyncedAt: new Date(),
  };
};

const saveLogsToDB = async (rows = []) => {
  if (!StellarAttendanceLog || !rows.length) {
    return { saved: 0, skipped: rows.length };
  }

  const mappedRows = rows.map(mapLogRowForDB).filter((row) => row?.accessId);
  if (!mappedRows.length) {
    return { saved: 0, skipped: rows.length };
  }

  await StellarAttendanceLog.bulkCreate(mappedRows, {
    updateOnDuplicate: [
      "registrationId",
      "logDate",
      "logTime",
      "logDateTime",
      "deviceName",
      "deviceId",
      "card",
      "rawPayload",
      "lastSyncedAt",
      "updatedAt",
    ],
  });

  return {
    saved: mappedRows.length,
    skipped: rows.length - mappedRows.length,
  };
};

const mapDBLogToStellarRow = (row) => ({
  ...(row.rawPayload || {}),
  access_id: row.accessId,
  registration_id: row.registrationId,
  access_date: row.logDate,
  access_time: row.logTime,
  date: row.logDate,
  time: row.logTime,
  device_name: row.deviceName,
  device_id: row.deviceId,
  card: row.card,
});

const readLogsFromDB = async (request) => {
  if (!StellarAttendanceLog) return [];

  const where = {
    logDate: {
      [db.Sequelize.Op.between]: [request.start_date, request.end_date],
    },
  };

  const rows = await StellarAttendanceLog.findAll({
    where,
    order: [
      ["logDate", "ASC"],
      ["logTime", "ASC"],
      ["accessId", "ASC"],
    ],
    raw: true,
  });

  return rows.map(mapDBLogToStellarRow);
};

const getCacheKey = (request) =>
  JSON.stringify({
    operation: request.operation,
    start_date: request.start_date,
    end_date: request.end_date,
    start_time: request.start_time,
    end_time: request.end_time,
    access_id: request.access_id,
  });

const getCachedResponse = (cacheKey) => {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  const ageMs = now - cached.cachedAtMs;
  if (ageMs >= CACHE_TTL_MS) {
    responseCache.delete(cacheKey);
    return null;
  }

  return {
    ...cached.data,
    cache: {
      status: "cached",
      cachedAt: new Date(cached.cachedAtMs).toISOString(),
      expiresAt: new Date(cached.cachedAtMs + CACHE_TTL_MS).toISOString(),
      ageSeconds: Math.floor(ageMs / 1000),
      ttlSeconds: Math.floor(CACHE_TTL_MS / 1000),
    },
  };
};

const setCachedResponse = (cacheKey, data) => {
  responseCache.set(cacheKey, {
    cachedAtMs: Date.now(),
    data,
  });
};

const buildCacheInfo = (cachedAtMs, status) => ({
  status,
  cachedAt: new Date(cachedAtMs).toISOString(),
  expiresAt: new Date(cachedAtMs + CACHE_TTL_MS).toISOString(),
  ageSeconds: Math.floor((Date.now() - cachedAtMs) / 1000),
  ttlSeconds: Math.floor(CACHE_TTL_MS / 1000),
});

const postStellar = async ({ request, endpoint, normalizeData, buildMeta }) => {
  const { authUser, authCode } = getCredentials();
  const cacheKey = getCacheKey(request);
  const cached = getCachedResponse(cacheKey);

  if (cached) return cached;

  const { data } = await axios.post(
    endpoint,
    {
      ...request,
      auth_user: authUser,
      auth_code: authCode,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    },
  );

  const rows = normalizeData(data);
  const result = {
    request: {
      endpoint,
      ...request,
    },
    meta: buildMeta(rows, request),
    rows,
    raw: data,
    cache: buildCacheInfo(Date.now(), "live"),
  };

  setCachedResponse(cacheKey, result);
  return result;
};

const fetchLogs = async (query) => {
  const request = normalizeRequest(query);
  const endpoint = request.operation === "fetch_gps_log" ? GPS_LOG_URL : JSON_API_URL;
  const dateSpanDays = getDateSpanDays(request.start_date, request.end_date);
  const shouldChunk = request.operation === "fetch_log" && dateSpanDays > 2;
  const syncRequested = shouldSyncFromQuery(query);
  const buildLogMeta = (rows, normalizedRequest) => ({
    count: rows.length,
    highestAccessId: rows.reduce((highest, row) => {
      const current = Number(row.access_id);
      return Number.isFinite(current) && current > highest ? current : highest;
    }, Number(normalizedRequest.access_id) || 0),
  });
  const buildStoredResult = async ({ status = "database", reason, syncLock } = {}) => {
    const rows = await readLogsFromDB(request);

    return {
      request: {
        endpoint,
        ...request,
        source: "database",
      },
      meta: {
        ...buildLogMeta(rows, request),
        source: "database",
        fallbackReason: reason,
        syncLock,
      },
      rows,
      raw: {
        source: "database",
      },
      cache: {
        ...buildCacheInfo(Date.now(), status),
        syncLock,
      },
    };
  };

  if (!syncRequested) {
    return buildStoredResult({
      status: "database",
      reason: "Served from saved attendance database",
    });
  }

  const syncState = await getSyncState(request);
  const syncLock = buildSyncLockInfo(syncState);
  if (syncLock.waitSeconds > 0) {
    return buildStoredResult({
      status: "sync_locked",
      reason: "Stellar sync was requested before the five-minute window ended",
      syncLock,
    });
  }

  if (!shouldChunk) {
    try {
      const result = await postStellar({
        request,
        endpoint,
        normalizeData: normalizeRows,
        buildMeta: buildLogMeta,
      });
      const dbSync = await saveLogsToDB(result.rows);
      const nextSyncLock = await markSyncAttempt(syncState, "success", "Stellar sync completed");
      return {
        ...result,
        meta: {
          ...result.meta,
          dbSync,
          syncLock: nextSyncLock,
        },
        cache: {
          ...result.cache,
          syncLock: nextSyncLock,
        },
      };
    } catch (error) {
      const nextSyncLock = await markSyncAttempt(syncState, "failed", error?.message || "Stellar sync failed");
      return buildStoredResult({
        status: "database",
        reason: error?.message || "Stellar API request failed",
        syncLock: nextSyncLock,
      });
    }
  }

  const chunks = buildTwoDayChunks(request);
  let chunkResults;

  try {
    chunkResults = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (chunkRequest) =>
      postStellar({
        request: chunkRequest,
        endpoint,
        normalizeData: normalizeRows,
        buildMeta: buildLogMeta,
      }),
    );
  } catch (error) {
    const nextSyncLock = await markSyncAttempt(syncState, "failed", error?.message || "Stellar sync failed");
    return buildStoredResult({
      status: "database",
      reason: error?.message || "Stellar API request failed",
      syncLock: nextSyncLock,
    });
  }

  const rows = chunkResults.flatMap((result) => result.rows || []);
  const dbSync = await saveLogsToDB(rows);
  const cachedAtMs = Date.now();
  const liveChunks = chunkResults.filter((result) => result.cache?.status === "live").length;
  const nextSyncLock = await markSyncAttempt(syncState, "success", "Stellar sync completed");

  return {
    request: {
      endpoint,
      ...request,
      chunked: true,
      chunkSizeDays: 2,
    },
    meta: {
      ...buildLogMeta(rows, request),
      chunks: chunkResults.length,
      chunkConcurrency: CHUNK_CONCURRENCY,
      liveChunks,
      cachedChunks: chunkResults.length - liveChunks,
      dateSpanDays,
      dbSync,
      syncLock: nextSyncLock,
    },
    rows,
    raw: {
      chunked: true,
      chunks: chunkResults.map((result) => ({
        request: result.request,
        meta: result.meta,
        cache: result.cache,
        raw: result.raw,
      })),
    },
    cache: {
      ...buildCacheInfo(cachedAtMs, liveChunks > 0 ? "live" : "cached"),
      syncLock: nextSyncLock,
    },
  };
};

const fetchUsers = async () => {
  const request = { operation: "fetch_user_list" };

  return postStellar({
    request,
    endpoint: JSON_API_URL,
    normalizeData: normalizeUsers,
    buildMeta: (rows) => ({
      count: rows.length,
    }),
  });
};

module.exports = {
  fetchLogs,
  fetchUsers,
};

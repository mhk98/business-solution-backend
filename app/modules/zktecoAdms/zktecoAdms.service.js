const crypto = require("crypto");
const db = require("../../../models");

const { Op } = db.Sequelize;
const AttendanceDevice = db.attendanceDevice;
const AttendancePunch = db.attendancePunch;

// ZKTeco ADMS ("push") devices post their punches straight to us. Each punch
// becomes an AttendancePunch row; the attendance engine
// (app/modules/attendance) turns punches into daily attendance.
//
// punchKey = sha1(serial|pin|datetime), so a re-sent punch upserts onto the
// same row instead of duplicating.
const buildPunchKey = (serialNumber, pin, dateTime) =>
  crypto.createHash("sha1").update(`${serialNumber}|${pin}|${dateTime}`).digest("hex");

// Devices are added by hand on HRM → Attendance Device (name + serial
// number). Only a registered device whose status isn't Inactive/Pending is
// accepted; anything else is answered "OK" (so it stops retrying) and its
// punches are not saved.
const IGNORED_STATUSES = new Set(["Inactive", "Pending"]);

const findRegisteredDevice = async (serialNumber) => {
  if (!serialNumber || !AttendanceDevice) return null;
  return AttendanceDevice.findOne({
    where: { serialNumber: String(serialNumber).trim() },
    paranoid: true,
  });
};

const isAccepted = (device) => Boolean(device) && !IGNORED_STATUSES.has(device.status);

// Warn once per serial (per process) so an unknown device that retries every
// few seconds doesn't flood the log.
const warnedSerials = new Set();
const warnIgnored = (serialNumber, ipAddress, device) => {
  if (warnedSerials.has(serialNumber)) return;
  warnedSerials.add(serialNumber);
  console.warn(
    device
      ? `[zktecoAdms] device SN=${serialNumber} is ${device.status} — punches ignored.`
      : `[zktecoAdms] unregistered device SN=${serialNumber} (${ipAddress || "unknown ip"}) — add it on HRM → Attendance Device.`,
  );
};

const touchDevice = async (device, ipAddress) => {
  if (!device) return;
  const patch = { lastSyncAt: new Date() };
  if (ipAddress) patch.ipAddress = String(ipAddress).slice(0, 64);
  await device.update(patch).catch(() => {});
};

// Device local time is Bangladesh time (UTC+6).
const buildLogDateTime = (logDate, logTime) => {
  const date = new Date(`${logDate}T${logTime}+06:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/;

// One punch → an AttendancePunch row.
const buildAttendanceRow = (serialNumber, deviceName, pin, dateTime, extra = {}) => {
  const match = DATE_TIME_RE.exec(String(dateTime || "").trim());
  const employeePin = String(pin || "").trim();
  if (!employeePin || employeePin === "0" || !match) return null;
  const [, punchDate, punchClock] = match;
  return {
    punchKey: buildPunchKey(serialNumber, employeePin, `${punchDate} ${punchClock}`),
    employeePin,
    punchDate,
    punchClock,
    punchAt: buildLogDateTime(punchDate, punchClock),
    source: "device",
    deviceSerial: serialNumber,
    deviceName,
    verifyMode: extra.verify !== undefined && extra.verify !== null ? String(extra.verify).slice(0, 32) : null,
    rawPayload: { source: "zkteco_adms", serialNumber, ...extra },
  };
};

const splitLines = (body) =>
  String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

// ATTLOG body (PUSH 1/2 attendance devices): one punch per line, tab
// separated — PIN, "YYYY-MM-DD HH:MM:SS", status, verify mode, workcode, …
const parseAttLog = (body, serialNumber, deviceName) =>
  splitLines(body)
    .map((line) => {
      const [pin, dateTime, status, verify, workCode] = line.split("\t");
      return buildAttendanceRow(serialNumber, deviceName, pin, dateTime, {
        status: status ?? null,
        verify: verify ?? null,
        workCode: workCode ?? null,
        line,
      });
    })
    .filter(Boolean);

// "user uid=1\tpin=2\tname=Foo" / "USER PIN=2\tName=Foo" / "time=…\tpin=…"
// → { uid, pin, name, … } (keys lower-cased; a leading table word is dropped).
const parseKeyValues = (line) => {
  let text = String(line || "").trim();
  const firstTab = text.indexOf("\t");
  const firstToken = firstTab === -1 ? text : text.slice(0, firstTab);
  const space = firstToken.indexOf(" ");
  if (space > 0 && !firstToken.slice(0, space).includes("=")) {
    text = text.slice(space + 1);
  }
  const fields = {};
  text.split("\t").forEach((part) => {
    const at = part.indexOf("=");
    if (at > 0) fields[part.slice(0, at).trim().toLowerCase()] = part.slice(at + 1).trim();
  });
  return fields;
};

// PUSH 3 "acc" devices (e.g. SenseFace 2A) report punches as access events.
// Events 0–19 are successful verifications; 20+ are denials/alarms.
const isSuccessEvent = (event) =>
  event === undefined || event === "" || Number(event) < 20;

// table=rtlog: "time=2026-10-03 16:04:10\tpin=2241\tcardno=0\tevent=0\t…"
const parseRtLog = (body, serialNumber, deviceName) =>
  splitLines(body)
    .map((line) => {
      const f = parseKeyValues(line);
      if (!isSuccessEvent(f.event)) return null;
      return buildAttendanceRow(serialNumber, deviceName, f.pin, f.time, {
        status: f.inoutstatus ?? null,
        verify: f.verifytype ?? null,
        event: f.event ?? null,
        card: f.cardno && f.cardno !== "0" ? f.cardno : null,
        line,
      });
    })
    .filter(Boolean);

// ZKTeco packed time: ((Y-2000)*12*31 + (M-1)*31 + D-1)*86400 + h*3600 + m*60 + s
const decodeZkTime = (value) => {
  let t = Number(value);
  if (!Number.isFinite(t) || t <= 0) return null;
  const second = t % 60; t = Math.floor(t / 60);
  const minute = t % 60; t = Math.floor(t / 60);
  const hour = t % 24; t = Math.floor(t / 24);
  const day = (t % 31) + 1; t = Math.floor(t / 31);
  const month = (t % 12) + 1; t = Math.floor(t / 12);
  const year = t + 2000;
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
};

// tablename=transaction (stored punches): "transaction pin=2\teventtype=0\ttime_second=…"
const parseTransactions = (body, serialNumber, deviceName) =>
  splitLines(body)
    .filter((line) => /^transaction\s/i.test(line))
    .map((line) => {
      const f = parseKeyValues(line);
      if (!isSuccessEvent(f.eventtype)) return null;
      return buildAttendanceRow(serialNumber, deviceName, f.pin, decodeZkTime(f.time_second), {
        status: f.inoutstate ?? null,
        verify: f.verified ?? null,
        event: f.eventtype ?? null,
        card: f.cardno && f.cardno !== "0" ? f.cardno : null,
        line,
      });
    })
    .filter(Boolean);

const saveAttLogs = async (rows) => {
  if (!rows.length) return 0;
  await AttendancePunch.bulkCreate(rows, {
    updateOnDuplicate: ["rawPayload", "updatedAt"],
  });
  // Recompute the punched dates (and the day before, for night shifts).
  // Required lazily: the attendance engine loads models on its own.
  const dates = rows.map((row) => row.punchDate).sort();
  const { scheduleRecompute } = require("../attendance/attendance.recompute");
  const { addDays } = require("../attendance/attendance.time");
  scheduleRecompute({ from: addDays(dates[0], -1), to: dates[dates.length - 1] }, 15000);
  return rows.length;
};

// --- Device users -----------------------------------------------------------
// Attendance Setup lists the people enrolled on the device. The device
// reports them as answers to a user-list query (sent from /getrequest) and,
// on enrolment, as user rows it pushes by itself.
const ZktecoDeviceUser = db.zktecoDeviceUser;
const USER_QUERY_INTERVAL_MS = 60 * 60 * 1000;

const parseUserLines = (body) =>
  splitLines(body)
    .filter((line) => /^user\s/i.test(line))
    .map((line) => {
      const f = parseKeyValues(line);
      const pin = f.pin || f.pin2;
      if (!pin) return null;
      return {
        pin,
        name: f.name || null,
        privilege: f.pri ?? f.privilege ?? null,
        card: f.card || (f.cardno && f.cardno !== "0" ? f.cardno : null),
      };
    })
    .filter(Boolean);

const saveDeviceUsers = async (serialNumber, users) => {
  if (!users.length || !ZktecoDeviceUser) return 0;
  const now = new Date();
  await ZktecoDeviceUser.bulkCreate(
    users.map((user) => ({ ...user, serialNumber, lastSeenAt: now })),
    { updateOnDuplicate: ["name", "privilege", "card", "lastSeenAt", "updatedAt"] },
  );
  return users.length;
};

// --- Per-device session (in memory; a restart re-handshakes) ---------------
// push3: the device speaks PUSH 3.x ("acc" devices — registry, rtlog,
// tabledata). queue: commands handed out one per /getrequest.
const sessions = new Map();
let nextCommandId = Date.now() % 100000;

const getSession = (serialNumber) => {
  if (!sessions.has(serialNumber)) {
    sessions.set(serialNumber, { push3: false, queue: [], userQuery: null, lastUserQueryAt: 0 });
  }
  return sessions.get(serialNumber);
};

const isPush3Request = (query = {}) =>
  /^3/.test(String(query.pushver || "")) ||
  String(query.DeviceType || query.devicetype || "").toLowerCase() === "acc";

const userQueryCommand = (session) =>
  session.push3 ? "DATA QUERY tablename=user,fielddesc=*,filter=*" : "DATA QUERY USERINFO";

const queueCommand = (session, command, kind) => {
  const id = ++nextCommandId;
  session.queue.push({ id, command, kind });
  return id;
};

const takeCommand = (serialNumber) => {
  const session = getSession(serialNumber);
  if (Date.now() - session.lastUserQueryAt >= USER_QUERY_INTERVAL_MS) {
    session.lastUserQueryAt = Date.now();
    queueCommand(session, userQueryCommand(session), "users");
  }
  const next = session.queue.shift();
  if (!next) return null;
  if (next.kind === "users") {
    session.userQuery = { id: next.id, issuedAt: new Date(), done: false };
  }
  console.log(`[zktecoAdms] SN=${serialNumber}: cmd ${next.id} ${next.command}`);
  return `C:${next.id}:${next.command}`;
};

// /devicecmd body: "ID=123&Return=0&CMD=DATA" (one line per command). Once
// the user-list query is confirmed, users the device no longer lists go.
const handleCommandResult = async ({ serialNumber, body }) => {
  const query = getSession(serialNumber).userQuery;
  for (const line of splitLines(body)) {
    const params = new URLSearchParams(line);
    const id = Number(params.get("ID"));
    const ret = Number(params.get("Return"));
    if (!query || query.done || id !== query.id) continue;
    query.done = true;
    if (ret < 0 || !ZktecoDeviceUser) {
      console.warn(`[zktecoAdms] SN=${serialNumber}: user list query failed (Return=${ret})`);
      continue;
    }
    const removed = await ZktecoDeviceUser.destroy({
      where: { serialNumber, lastSeenAt: { [Op.lt]: query.issuedAt } },
    });
    const total = await ZktecoDeviceUser.count({ where: { serialNumber } });
    console.log(`[zktecoAdms] SN=${serialNumber}: user list synced — ${total} user(s), ${removed} removed`);
  }
  return "OK";
};

// Rows of a user/transaction table (query answers, or rows the device pushes).
const saveTableData = async (serialNumber, deviceName, tablename, body) => {
  const name = String(tablename || "").toLowerCase();
  if (name === "user") return saveDeviceUsers(serialNumber, parseUserLines(body));
  if (name === "transaction") {
    return saveAttLogs(parseTransactions(body, serialNumber, deviceName));
  }
  return 0;
};

// POST /querydata?SN=…&type=tabledata&tablename=user&count=N — query answers.
const handleQueryData = async ({ serialNumber, tablename, table, body, ipAddress }) => {
  const device = await findRegisteredDevice(serialNumber);
  if (!isAccepted(device)) return "OK";
  await touchDevice(device, ipAddress);
  const name = tablename || table || "user";
  const saved = await saveTableData(serialNumber, device.name || null, name, body);
  console.log(`[zktecoAdms] querydata SN=${serialNumber} table=${name}: ${saved} row(s)`);
  return `${name}=${saved}`;
};

const listDeviceUsers = async ({ serialNumber } = {}) => {
  if (!ZktecoDeviceUser) return [];
  return ZktecoDeviceUser.findAll({
    where: serialNumber ? { serialNumber } : {},
    attributes: ["serialNumber", "pin", "name", "lastSeenAt"],
    order: [["pin", "ASC"]],
    raw: true,
  });
};

// --- Handshake -----------------------------------------------------------------
// PUSH 1/2 (attendance devices): plain option list. TransFlag's items are
// TAB-separated — with spaces the device doesn't recognise AttLog.
const buildHandshake = (serialNumber) =>
  [
    `GET OPTION FROM: ${serialNumber}`,
    "ATTLOGStamp=None",
    "OPERLOGStamp=9999",
    "ATTPHOTOStamp=None",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog\tOpLog\tEnrollUser\tChgUser",
    "TimeZone=6",
    "Realtime=1",
    "Encrypt=None",
  ].join("\n");

// PUSH 3 devices register first (POST /registry → RegistryCode) and then
// expect "registry=ok" plus their session options on /cdata and /push.
const registryCode = (serialNumber) =>
  crypto.createHash("sha1").update(`kafela-adms|${serialNumber}`).digest("hex").slice(0, 10);

const buildPush3Options = (serialNumber) =>
  [
    "registry=ok",
    `RegistryCode=${registryCode(serialNumber)}`,
    "ServerVersion=3.1.2",
    "ServerName=ADMS",
    "PushProtVer=3.1.2",
    "ErrorDelay=30",
    "RequestDelay=10",
    "TransTimes=00:00\t14:00",
    "TransInterval=1",
    "TransTables=User\tTransaction",
    "Realtime=1",
    `SessionID=${crypto.createHash("md5").update(`${serialNumber}|${Date.now()}`).digest("hex").toUpperCase()}`,
    "TimeoutSec=10",
  ].join("\n");

const startSession = (serialNumber, push3) => {
  // A fresh connection: re-read users, and (PUSH 3) the stored punches.
  const session = { push3, queue: [], userQuery: null, lastUserQueryAt: 0 };
  sessions.set(serialNumber, session);
  if (push3) {
    queueCommand(session, "DATA QUERY tablename=transaction,fielddesc=*,filter=*", "transactions");
  }
  return session;
};

const handleHandshake = async ({ serialNumber, ipAddress, query }) => {
  const device = await findRegisteredDevice(serialNumber);
  const push3 = isPush3Request(query);
  if (!isAccepted(device)) warnIgnored(serialNumber, ipAddress, device);
  else {
    console.log(`[zktecoAdms] handshake SN=${serialNumber} push${push3 ? "3" : "1/2"} (${ipAddress || "unknown ip"})`);
    startSession(serialNumber, push3);
  }
  await touchDevice(device, ipAddress);
  return push3 ? buildPush3Options(serialNumber) : buildHandshake(serialNumber);
};

// POST /registry (PUSH 3): the device sends its capabilities, we hand back
// its registry code.
const handleRegistry = async ({ serialNumber, ipAddress }) => {
  const device = await findRegisteredDevice(serialNumber);
  if (!isAccepted(device)) {
    warnIgnored(serialNumber, ipAddress, device);
    return "OK";
  }
  await touchDevice(device, ipAddress);
  return `RegistryCode=${registryCode(serialNumber)}`;
};

// GET/POST /push (PUSH 3): the device downloads its session options.
const handlePushConfig = async ({ serialNumber, ipAddress }) => {
  const device = await findRegisteredDevice(serialNumber);
  await touchDevice(device, ipAddress);
  if (isAccepted(device) && !getSession(serialNumber).push3) startSession(serialNumber, true);
  return buildPush3Options(serialNumber);
};

const handleUpload = async ({ serialNumber, table, tablename, body, ipAddress }) => {
  const device = await findRegisteredDevice(serialNumber);
  if (!isAccepted(device)) {
    warnIgnored(serialNumber, ipAddress, device);
    return "OK";
  }
  await touchDevice(device, ipAddress);
  const deviceName = device.name || null;
  const tableName = String(table || "").toUpperCase();
  const lineCount = splitLines(body).length;

  if (tableName === "ATTLOG" || tableName === "RTLOG") {
    const rows =
      tableName === "ATTLOG"
        ? parseAttLog(body, serialNumber, deviceName)
        : parseRtLog(body, serialNumber, deviceName);
    const saved = await saveAttLogs(rows);
    // Visible in the host's runtime logs — shows whether punches arrive and
    // whether their lines parse.
    console.log(`[zktecoAdms] ${tableName} SN=${serialNumber}: ${lineCount} line(s), ${saved} saved`);
    return tableName === "ATTLOG" ? `OK: ${saved}` : "OK";
  }
  if (tableName === "TABLEDATA") {
    const saved = await saveTableData(serialNumber, deviceName, tablename, body);
    console.log(`[zktecoAdms] tabledata SN=${serialNumber} ${tablename || "-"}: ${saved} row(s)`);
    return `${tablename || "data"}=${saved}`;
  }
  if (tableName === "OPERLOG" || tableName === "USERINFO" || tableName === "USER") {
    const saved = await saveDeviceUsers(serialNumber, parseUserLines(body));
    if (saved) console.log(`[zktecoAdms] ${tableName} SN=${serialNumber}: ${saved} user(s) saved`);
    return "OK";
  }
  return "OK"; // rtstate (door status) and other tables
};

const handlePoll = async ({ serialNumber, ipAddress }) => {
  const device = await findRegisteredDevice(serialNumber);
  await touchDevice(device, ipAddress);
  if (!isAccepted(device)) return "OK";
  return takeCommand(serialNumber) || "OK";
};

// GET /ping: heartbeat only — commands go out on /getrequest.
const handleHeartbeat = async ({ serialNumber, ipAddress }) => {
  await touchDevice(await findRegisteredDevice(serialNumber), ipAddress);
  return "OK";
};

const getRecentAdmsLogs = async (limit = 20) =>
  AttendancePunch.findAll({
    where: { source: "device" },
    order: [["punchDate", "DESC"], ["punchClock", "DESC"]],
    limit,
    raw: true,
  });

module.exports = {
  handleHandshake,
  handleRegistry,
  handlePushConfig,
  handleUpload,
  handlePoll,
  handleHeartbeat,
  handleQueryData,
  handleCommandResult,
  parseAttLog,
  parseRtLog,
  parseTransactions,
  parseUserLines,
  decodeZkTime,
  listDeviceUsers,
  getRecentAdmsLogs,
};

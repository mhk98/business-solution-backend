// Recompute queue + the model hooks that feed it. Anything that changes a
// day's outcome (a punch, holiday, leave, regularization, shift, employee
// setup) schedules a recompute of just the affected dates/employees; runs are
// merged and serialized so bursts (a device uploading 200 punches) cost one
// engine pass.

const db = require("../../../models");
const { computeRange } = require("./attendance.engine");
const { addDays, bdToday, maxYmd, minYmd, toBdParts } = require("./attendance.time");

const DEFAULT_DELAY_MS = 3000;

let pending = null; // { from, to, employeeIds: Set | null (= everyone) }
let timer = null;
let fireAt = 0;
let chain = Promise.resolve();

const mergeInto = (target, request) => {
  if (!target) {
    return {
      from: request.from,
      to: request.to,
      employeeIds: request.employeeIds ? new Set(request.employeeIds.map(Number)) : null,
    };
  }
  target.from = minYmd(target.from, request.from);
  target.to = maxYmd(target.to, request.to);
  if (!target.employeeIds || !request.employeeIds) target.employeeIds = null;
  else request.employeeIds.forEach((id) => target.employeeIds.add(Number(id)));
  return target;
};

const runNow = (request) => {
  const job = chain.then(() =>
    computeRange({
      from: request.from,
      to: request.to,
      employeeIds: request.employeeIds ? [...request.employeeIds] : null,
    }),
  );
  chain = job.catch((error) => console.error("[attendance] recompute failed:", error.message));
  return job;
};

const flush = () => {
  timer = null;
  fireAt = 0;
  const request = pending;
  pending = null;
  if (request) runNow(request).catch(() => {});
};

// Fire-and-forget; callers never wait on the engine.
const scheduleRecompute = ({ from, to, employeeIds = null }, delayMs = DEFAULT_DELAY_MS) => {
  if (!from) return;
  const today = bdToday();
  const end = minYmd(to || from, today);
  if (from > end) return;
  const ids = Array.isArray(employeeIds) ? employeeIds.filter(Boolean) : null;
  if (Array.isArray(employeeIds) && !ids.length) return;
  pending = mergeInto(pending, { from, to: end, employeeIds: ids });
  // A sooner request pulls the merged run forward instead of waiting behind
  // a longer delay (e.g. a device upload's 15 s debounce).
  const due = Date.now() + delayMs;
  if (timer && due >= fireAt) return;
  clearTimeout(timer);
  fireAt = due;
  timer = setTimeout(flush, delayMs);
  timer.unref?.();
};

// Awaitable recompute (API "Recompute" button, background job).
const recomputeNow = ({ from, to, employeeIds = null }) =>
  runNow({ from, to, employeeIds: Array.isArray(employeeIds) && employeeIds.length ? new Set(employeeIds) : null });

// --- Regularization → punches ---------------------------------------------
// An approved regularization becomes manual punches (its requested in/out),
// so the engine treats it like any other punch; un-approving or deleting it
// removes them again.
// Upsert-then-prune (never delete-then-insert), so a recompute running
// in between always sees the punches.
const syncRegularizationPunches = async (row) => {
  if (!row?.Id) return [];
  const approved = String(row.approvalStatus || "") === "Approved" && !row.deletedAt;
  const punches = !approved ? [] : [
    ["in", row.requestedIn],
    ["out", row.requestedOut],
  ]
    .map(([kind, value]) => {
      const parts = value ? toBdParts(value) : null;
      if (!parts) return null;
      return {
        punchKey: `reg:${row.Id}:${kind}`,
        employeeId: row.employeeId,
        punchDate: parts.date,
        punchClock: parts.clock,
        punchAt: new Date(value),
        source: "regularization",
        regularizationId: row.Id,
        note: String(row.reason || "").slice(0, 255) || null,
      };
    })
    .filter(Boolean);
  if (punches.length) {
    await db.attendancePunch.bulkCreate(punches, {
      updateOnDuplicate: ["employeeId", "punchDate", "punchClock", "punchAt", "note", "updatedAt"],
    });
  }
  await db.attendancePunch.destroy({
    where: {
      regularizationId: row.Id,
      ...(punches.length ? { punchKey: { [db.Sequelize.Op.notIn]: punches.map((punch) => punch.punchKey) } } : {}),
    },
  });
  return punches.map((punch) => punch.punchDate);
};

// --- Model hooks --------------------------------------------------------------
const plain = (row) => (row?.get ? row.get({ plain: true }) : row);
const ymd = (value) => (value ? String(value).slice(0, 10) : null);
const monthStart = () => `${bdToday().slice(0, 7)}-01`;

// Watches a model: every create/update/delete (instance or bulk) passes the
// old and new versions of each touched row to `targetsOf`, which returns the
// recompute requests.
const watchModel = (model, targetsOf) => {
  if (!model || model.__attendanceWatched) return;
  model.__attendanceWatched = true;

  const emit = async (rows) => {
    for (const row of rows) {
      if (!row) continue;
      const targets = (await targetsOf(row)) || [];
      targets.forEach((target) => scheduleRecompute(target));
    }
  };
  const safe = (fn) => async (...args) => {
    try {
      await fn(...args);
    } catch (error) {
      console.error(`[attendance] ${model.name} hook failed:`, error.message);
    }
  };
  const fetchRows = (options) =>
    model.findAll({ where: options.where, paranoid: false, transaction: options.transaction });

  model.addHook("afterCreate", safe((instance) => emit([plain(instance)])));
  model.addHook(
    "afterUpdate",
    safe((instance) => emit([{ ...instance._previousDataValues }, plain(instance)])),
  );
  model.addHook("afterDestroy", safe((instance) => emit([plain(instance)])));
  model.addHook(
    "beforeBulkUpdate",
    safe(async (options) => {
      options.__attendanceBefore = (await fetchRows(options)).map(plain);
    }),
  );
  model.addHook(
    "afterBulkUpdate",
    safe(async (options) => {
      // Re-read by Id: the update may have changed the columns in `where`.
      const before = options.__attendanceBefore || [];
      const ids = before.map((row) => row.Id).filter(Boolean);
      const after = ids.length
        ? (await model.findAll({ where: { Id: ids }, paranoid: false, transaction: options.transaction })).map(plain)
        : [];
      await emit([...before, ...after]);
    }),
  );
  model.addHook(
    "beforeBulkDestroy",
    safe(async (options) => {
      options.__attendanceBefore = (await fetchRows(options)).map(plain);
    }),
  );
  model.addHook(
    "afterBulkDestroy",
    safe(async (options) => {
      const before = options.__attendanceBefore || [];
      const ids = before.map((row) => row.Id).filter(Boolean);
      const after = ids.length
        ? (await model.findAll({ where: { Id: ids }, paranoid: false, transaction: options.transaction })).map(plain)
        : [];
      await emit(after.length ? after : before.map((row) => ({ ...row, deletedAt: new Date() })));
    }),
  );
};

let hooksRegistered = false;

const registerAttendanceHooks = () => {
  if (hooksRegistered) return;
  hooksRegistered = true;

  watchModel(db.holiday, (row) => {
    const from = ymd(row.startDate || row.holidayDate);
    return from ? [{ from, to: ymd(row.endDate) || from }] : [];
  });

  watchModel(db.leaveRequest, (row) =>
    row.employeeId && row.startDate
      ? [{ from: ymd(row.startDate), to: ymd(row.endDate) || ymd(row.startDate), employeeIds: [row.employeeId] }]
      : [],
  );

  watchModel(db.employeeShiftAssignment, (row) =>
    row.employeeId && row.effectiveFrom
      ? [{ from: ymd(row.effectiveFrom), to: ymd(row.effectiveTo) || bdToday(), employeeIds: [row.employeeId] }]
      : [],
  );

  // A shift's timing has no history, so an edit re-applies from this month.
  watchModel(db.shift, () => [{ from: monthStart(), to: bdToday() }]);

  watchModel(db.employeeList, (row) => {
    if (!row.Id) return [];
    const from = minYmd(monthStart(), ymd(row.joiningDate), ymd(row.exitDate));
    return [{ from, to: bdToday(), employeeIds: [row.Id] }];
  });

  watchModel(db.attendanceRegularization, async (row) => {
    if (!row.Id || !row.employeeId) return [];
    // Old and new versions both arrive; always sync from the current row.
    const current = await db.attendanceRegularization.findByPk(row.Id, { paranoid: false, raw: true });
    const dates = await syncRegularizationPunches(current || row);
    const date = ymd(row.attendanceDate);
    const all = [date, ...dates].filter(Boolean).sort();
    if (!all.length) return [];
    return [{ from: addDays(all[0], -1), to: all.at(-1), employeeIds: [row.employeeId] }];
  });
};

module.exports = {
  scheduleRecompute,
  recomputeNow,
  registerAttendanceHooks,
  syncRegularizationPunches,
};

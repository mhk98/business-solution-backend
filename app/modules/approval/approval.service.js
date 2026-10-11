const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ENUM_USER_ROLE } = require("../../enums/user");
const {
  REQUISITION_MODEL_KEYS,
  WORKFLOW_MODELS,
  hasAttribute,
  isApprover,
  notifyUsers,
  rebuildAssetsIfNeeded,
  deleteWorkflowRecord,
  findOpenRequest,
  markRequestNotificationsRead,
} = require("./approvalCore");

const LEGACY_UPDATE_MARKER = /\[Approval pending for update\]/;
const IGNORED_CHANGE_FIELDS = new Set([
  "Id", "userId", "actorRole", "status", "createdAt", "updatedAt", "deletedAt",
  "pendingAction", "approvalNote", "requestedByUserId",
]);

// MariaDB stores JSON as text; raw reads hand it back as a string.
const parsePayload = (payload) => {
  if (typeof payload !== "string") return payload || {};
  try {
    return JSON.parse(payload) || {};
  } catch {
    return {};
  }
};

const userName = (user) =>
  user ? [user.FirstName, user.LastName].filter(Boolean).join(" ") || user.Email || `User #${user.Id}` : null;

const firstValue = (row, fields) => {
  for (const field of fields) {
    const value = row?.[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return null;
};

// A short description of the record for the approval list.
const describeRecord = (row) => ({
  title: firstValue(row, [
    "name", "productName", "title", "itemName", "supplierName", "partyName",
    "purpose", "category", "remarks", "paymentMode",
  ]),
  amount: firstValue(row, ["total", "amount", "totalAmount", "totalPrice", "price"]),
  quantity: firstValue(row, ["quantity", "qty"]),
  date: row?.date ? String(row.date).slice(0, 10) : null,
});

const sameValue = (a, b) => {
  if (a === b) return true;
  if (a === null || a === undefined || a === "") return b === null || b === undefined || b === "";
  if (typeof b === "object" || typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  const na = Number(a);
  const nb = Number(b);
  if (String(a).trim() !== "" && String(b).trim() !== "" && Number.isFinite(na) && Number.isFinite(nb)) {
    return na === nb;
  }
  return String(a).slice(0, 19) === String(b).slice(0, 19) || String(a).slice(0, 10) === String(b);
};

// Fields the requested edit would change, old → new.
const describeChanges = (Model, row, body = {}) =>
  Object.entries(body)
    .filter(([field]) => !IGNORED_CHANGE_FIELDS.has(field) && hasAttribute(Model, field))
    .filter(([field, value]) => !sameValue(row?.[field], value))
    .map(([field, value]) => ({ field, from: row?.[field] ?? null, to: value ?? null }));

const workflowModelKeys = () =>
  [...WORKFLOW_MODELS.keys()].filter(
    (key) => !REQUISITION_MODEL_KEYS.has(key) && hasAttribute(db[key], "status"),
  );

const ensureApprover = async (user) => {
  if (!(await isApprover(user))) {
    throw new ApiError(403, "Only admin, superAdmin or a department head can approve");
  }
};

// --- List -----------------------------------------------------------------------

// Everything waiting for an approver: edit/delete requests, plus records that
// are Pending without one (back-dated entries, and requests made before
// ApprovalRequests existed).
const listPending = async (user) => {
  if (!(await isApprover(user))) return { isApprover: false, items: [] };

  const requests = await db.approvalRequest.findAll({
    where: { status: "Pending" },
    order: [["createdAt", "ASC"]],
    raw: true,
  });
  const requestKeys = new Set(requests.map((row) => `${row.modelKey}:${row.recordId}`));

  const scanned = (
    await Promise.all(
      workflowModelKeys().map(async (modelKey) => {
        const rows = await db[modelKey].findAll({
          where: { status: { [Op.in]: ["Pending", "Pending Delete"] } },
          order: [["Id", "DESC"]],
          raw: true,
        });
        return rows
          .filter((row) => !requestKeys.has(`${modelKey}:${row.Id}`))
          .map((row) => ({ modelKey, row }));
      }),
    )
  ).flat();

  const recordsByRequest = await Promise.all(
    requests.map((request) =>
      db[request.modelKey]
        ? db[request.modelKey].findOne({ where: { Id: request.recordId }, raw: true })
        : null,
    ),
  );

  const requesterIds = [...new Set(requests.map((row) => row.requestedByUserId).filter(Boolean))];
  const requesters = requesterIds.length
    ? await db.user.findAll({
        where: { Id: { [Op.in]: requesterIds } },
        attributes: ["Id", "FirstName", "LastName", "Email"],
        raw: true,
      })
    : [];
  const requesterById = new Map(requesters.map((row) => [Number(row.Id), row]));

  const items = [
    ...requests.map((request, index) => {
      const record = recordsByRequest[index];
      return {
        key: `request-${request.Id}`,
        modelKey: request.modelKey,
        entityLabel: request.entityLabel || WORKFLOW_MODELS.get(request.modelKey) || request.modelKey,
        recordId: request.recordId,
        action: request.action,
        reason: request.reason,
        requestedBy: userName(requesterById.get(Number(request.requestedByUserId))),
        requestedAt: request.createdAt,
        record: describeRecord(record),
        changes:
          request.action === "Update" && record
            ? describeChanges(db[request.modelKey], record, parsePayload(request.payload).body)
            : [],
        missing: !record,
      };
    }),
    ...scanned.map(({ modelKey, row }) => {
      const isDelete = row.status === "Pending Delete";
      const legacyUpdate = !isDelete && LEGACY_UPDATE_MARKER.test(String(row.note || ""));
      return {
        key: `record-${modelKey}-${row.Id}`,
        modelKey,
        entityLabel: WORKFLOW_MODELS.get(modelKey) || modelKey,
        recordId: row.Id,
        // Old-style edits were already saved; approving/rejecting only clears the flag.
        action: isDelete ? "Delete" : legacyUpdate ? "Update (already saved)" : "Create",
        reason: isDelete ? row.note || null : null,
        requestedBy: null,
        requestedAt: row.updatedAt || row.createdAt,
        record: describeRecord(row),
        changes: [],
      };
    }),
  ].sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));

  return { isApprover: true, items };
};

// --- Replaying an approved edit ------------------------------------------------

// Finds the route the edit was sent to (e.g. PUT /api/v1/assets-purchase/12)
// the same way Express dispatches it.
const findRoute = (stack, path, method) => {
  for (const layer of stack) {
    if (!layer.match(path)) continue;
    if (layer.route) {
      if (layer.route._handles_method(method)) {
        return { route: layer.route, params: { ...layer.params } };
      }
      continue;
    }
    if (layer.handle?.stack) {
      const rest = path.slice(layer.path.length) || "/";
      const found = findRoute(layer.handle.stack, rest.startsWith("/") ? rest : `/${rest}`, method);
      if (found) return found;
    }
  }
  return null;
};

// Runs the module's own update handler(s) — everything after the approval
// middleware on that route — as the approver, so stock, ledgers and logs are
// updated exactly as if the approver had made the edit.
const replayUpdate = (originalReq, request, approver) =>
  new Promise((resolve, reject) => {
    const method = String(request.method || "PUT").toUpperCase();
    const found = findRoute(originalReq.app._router.stack, request.url, method);
    if (!found) {
      reject(new ApiError(500, "Could not find the update route for this request"));
      return;
    }
    const layers = found.route.stack.filter(
      (layer) => !layer.method || layer.method === method.toLowerCase(),
    );
    const workflowIndex = layers.findIndex((layer) => layer.handle?.isApprovalWorkflow);
    const handlers = layers.slice(workflowIndex + 1).map((layer) => layer.handle);
    if (workflowIndex < 0 || !handlers.length) {
      reject(new ApiError(500, "Could not find the update handler for this request"));
      return;
    }

    const payload = parsePayload(request.payload);
    const body = { ...(payload.body || {}) };
    body.status = /^pending/i.test(String(body.status || "")) || !body.status ? "Active" : body.status;
    body.actorRole = [ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN].includes(approver.role)
      ? approver.role
      : ENUM_USER_ROLE.ADMIN;
    delete body.pendingAction;
    delete body.approvalNote;
    delete body.requestedByUserId;

    const req = Object.create(originalReq);
    Object.assign(req, {
      method,
      url: request.url,
      originalUrl: request.url,
      baseUrl: request.url.replace(/\/[^/]*$/, ""),
      params: found.params,
      query: {},
      body,
      file: payload.file || undefined,
      user: approver,
    });

    let statusCode = 200;
    const res = {
      statusCode,
      locals: {},
      headersSent: false,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      set() {
        return this;
      },
      setHeader() {
        return this;
      },
      json(payload) {
        this.headersSent = true;
        if (statusCode >= 400 || payload?.success === false) {
          reject(new ApiError(statusCode >= 400 ? statusCode : 400, payload?.message || "Update failed"));
        } else {
          resolve(payload);
        }
        return this;
      },
      send(payload) {
        return this.json(typeof payload === "object" ? payload : { success: true, data: payload });
      },
    };

    let index = 0;
    const next = (error) => {
      if (error) {
        reject(error);
        return;
      }
      const handler = handlers[index++];
      if (!handler) {
        reject(new ApiError(500, "The update did not respond"));
        return;
      }
      Promise.resolve()
        .then(() => handler(req, res, next))
        .catch(reject);
    };
    next();
  });

// --- Approve / reject ------------------------------------------------------------

const parseKey = (key) => {
  const requestMatch = /^request-(\d+)$/.exec(String(key));
  if (requestMatch) return { requestId: Number(requestMatch[1]) };
  const recordMatch = /^record-([A-Za-z]+)-(\d+)$/.exec(String(key));
  if (recordMatch) return { modelKey: recordMatch[1], recordId: Number(recordMatch[2]) };
  throw new ApiError(400, "Invalid approval key");
};

const loadOpenRequest = async (requestId) => {
  const request = await db.approvalRequest.findOne({ where: { Id: requestId } });
  if (!request) throw new ApiError(404, "Approval request not found");
  if (request.status !== "Pending") {
    throw new ApiError(409, `This request was already ${request.status.toLowerCase()}`);
  }
  return request;
};

const resolveRequest = async (request, approver, status, note) => {
  await request.update({
    status,
    resolvedByUserId: approver.Id,
    resolvedAt: new Date(),
    resolutionNote: note || null,
  });
  await markRequestNotificationsRead(request);
};

const restoreRecord = async (request) => {
  const Model = db[request.modelKey];
  const restore = {};
  if (hasAttribute(Model, "status")) restore.status = request.previousStatus || "Active";
  if (hasAttribute(Model, "note")) restore.note = request.previousNote ?? null;
  if (Object.keys(restore).length) {
    await Model.update(restore, { where: { Id: request.recordId } });
  }
  await rebuildAssetsIfNeeded(request.modelKey);
};

const notifyRequester = async (request, approved, note) => {
  if (!request.requestedByUserId) return;
  const verb = request.action === "Delete" ? "delete" : "edit";
  await notifyUsers(
    [request.requestedByUserId],
    `Your ${request.entityLabel || "record"} ${verb} request was ${approved ? "approved" : "rejected"}${
      !approved && note ? `: ${note}` : ""
    }`,
    "notifications",
  );
};

const scannedRecord = async (modelKey, recordId) => {
  if (!WORKFLOW_MODELS.has(modelKey) || REQUISITION_MODEL_KEYS.has(modelKey)) {
    throw new ApiError(400, "This record is not part of the approval workflow");
  }
  const row = await db[modelKey].findOne({ where: { Id: recordId } });
  if (!row) throw new ApiError(404, "Record not found");
  if (!/^pending/i.test(String(row.status || ""))) {
    throw new ApiError(409, "This record is no longer pending");
  }
  if (await findOpenRequest(modelKey, recordId)) {
    throw new ApiError(409, "Reload the list — this record has a newer request");
  }
  return row;
};

const clearLegacyMarker = (note) =>
  String(note || "").replace(LEGACY_UPDATE_MARKER, "").replace(/\s+/g, " ").trim() || null;

const approve = async (key, approver, req) => {
  await ensureApprover(approver);
  const parsed = parseKey(key);

  if (parsed.requestId) {
    const request = await loadOpenRequest(parsed.requestId);
    const Model = db[request.modelKey];
    if (!(await Model.findOne({ where: { Id: request.recordId } }))) {
      await resolveRequest(request, approver, "Rejected", "Record no longer exists");
      throw new ApiError(404, "The record no longer exists");
    }
    if (request.action === "Delete") {
      await deleteWorkflowRecord(request.modelKey, request.recordId);
    } else {
      // Put the record back as it was, then let the module apply the edit itself.
      await restoreRecord(request);
      await replayUpdate(req, request, approver);
      if (hasAttribute(Model, "status")) {
        await Model.update({ status: "Active" }, { where: { Id: request.recordId, status: { [Op.like]: "Pending%" } } });
      }
    }
    await resolveRequest(request, approver, "Approved");
    await notifyRequester(request, true);
    return { action: request.action, status: request.action === "Delete" ? "Deleted" : "Active" };
  }

  const { modelKey, recordId } = parsed;
  const row = await scannedRecord(modelKey, recordId);
  if (row.status === "Pending Delete") {
    await deleteWorkflowRecord(modelKey, recordId);
    return { action: "Delete", status: "Deleted" };
  }
  const patch = { status: "Active" };
  if (hasAttribute(db[modelKey], "note") && LEGACY_UPDATE_MARKER.test(String(row.note || ""))) {
    patch.note = clearLegacyMarker(row.note);
  }
  await db[modelKey].update(patch, { where: { Id: recordId } });
  await rebuildAssetsIfNeeded(modelKey);
  return { action: "Create", status: "Active" };
};

const reject = async (key, approver, note) => {
  await ensureApprover(approver);
  const parsed = parseKey(key);

  if (parsed.requestId) {
    const request = await loadOpenRequest(parsed.requestId);
    // The record was never changed for an edit request; only the flag is undone.
    if (db[request.modelKey] && (await db[request.modelKey].findOne({ where: { Id: request.recordId } }))) {
      await restoreRecord(request);
    }
    await resolveRequest(request, approver, "Rejected", note);
    await notifyRequester(request, false, note);
    return { action: request.action, status: request.previousStatus || "Active" };
  }

  const { modelKey, recordId } = parsed;
  const row = await scannedRecord(modelKey, recordId);
  const Model = db[modelKey];
  if (row.status === "Pending Delete") {
    // Delete requested before ApprovalRequests existed: keep the record.
    await Model.update({ status: "Active" }, { where: { Id: recordId } });
    await rebuildAssetsIfNeeded(modelKey);
    return { action: "Delete", status: "Active" };
  }
  if (LEGACY_UPDATE_MARKER.test(String(row.note || ""))) {
    // An old-style edit was already saved; there is no earlier copy to go back to.
    const patch = { status: "Active" };
    if (hasAttribute(Model, "note")) patch.note = clearLegacyMarker(row.note);
    await Model.update(patch, { where: { Id: recordId } });
    await rebuildAssetsIfNeeded(modelKey);
    return { action: "Update", status: "Active" };
  }
  // A pending new entry: rejecting means it never happened.
  await deleteWorkflowRecord(modelKey, recordId);
  return { action: "Create", status: "Deleted" };
};

module.exports = {
  listPending,
  approve,
  reject,
};

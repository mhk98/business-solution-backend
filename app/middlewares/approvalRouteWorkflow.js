const db = require("../../models");
const ApiError = require("../../error/ApiError");
const { Op } = require("sequelize");
const { ENUM_USER_ROLE } = require("../enums/user");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../shared/approvalWorkflow");
const {
  rebuildAssetsStockBalances,
} = require("../modules/assetsStock/assetsStockSync");
const {
  REQUISITION_MODEL_KEYS,
  closeOpenRequests,
  findOpenRequest,
  isApprover,
  notifyApprovers,
  registerWorkflowModel,
  rebuildAssetsIfNeeded,
  stockDeleteService,
} = require("../modules/approval/approvalCore");

const Notification = db.notification;
const User = db.user;
const PENDING_UPDATE_NOTE = "[Approval pending for update]";
const UPDATE_APPROVED_NOTE = "[Update request approved]";

const readDeleteNote = (req) =>
  req.body?.note ||
  req.body?.approvalNote ||
  req.query?.note ||
  req.headers["x-delete-note"] ||
  req.headers["x-approval-note"];

const hasAttribute = (Model, field) => Boolean(Model?.rawAttributes?.[field]);
const resolveWorkflowModelKey = (modelKey, req) =>
  typeof modelKey === "function" ? modelKey(req) : modelKey;

const stripWorkflowNote = (value) =>
  String(value || "")
    .replace(/\[Approval pending for update\]/g, "")
    .replace(/\[Update request approved\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(undefined|null)$/i, "");

const buildPendingUpdateNote = (value) => {
  const note = stripWorkflowNote(value);
  return note ? `${note} ${PENDING_UPDATE_NOTE}` : PENDING_UPDATE_NOTE;
};

const buildApprovedUpdateNote = (value) => {
  const note = stripWorkflowNote(value);
  return note ? `${note} ${UPDATE_APPROVED_NOTE}` : UPDATE_APPROVED_NOTE;
};

const notifyApprovedPettyCash = async (req) => {
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: req.user?.Id || null },
      role: { [Op.in]: [ENUM_USER_ROLE.ACCOUNTANT] },
    },
  });

  if (!users.length) return;

  await Promise.all(
    users.map((user) =>
      Notification.create({
        userId: user.Id,
        message: "Petty cash requisition request approved",
        url: `/${process.env.APP_BASE_URL}/petty-cash`,
      }),
    ),
  );
};

const notifyApprovedAssetsRequisition = async (req) => {
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: req.user?.Id || null },
      role: { [Op.in]: [ENUM_USER_ROLE.INVENTOR] },
    },
  });

  if (!users.length) return;

  await Promise.all(
    users.map((user) =>
      Notification.create({
        userId: user.Id,
        message: "Assets requisition request approved",
        url: `/${process.env.APP_BASE_URL}/assets-requisition`,
      }),
    ),
  );
};

// Requisitions keep the original flow (see REQUISITION_MODEL_KEYS).
const legacyApprovalWorkflow =
  ({ modelKey, entityLabel, updatePrivilegedRoles }) =>
  async (req, res, next) => {
    try {
      const resolvedModelKey = resolveWorkflowModelKey(modelKey, req);
      const Model = db[resolvedModelKey];
      if (!Model) {
        throw new ApiError(
          500,
          `${entityLabel || resolvedModelKey} workflow model not found`,
        );
      }

      if (req.method === "POST") {
        const nextBody = applyCreateWorkflow(req.body || {}, req.user || {}, {
          hasDateField: hasAttribute(Model, "date"),
        });
        if (!hasAttribute(Model, "status")) {
          delete nextBody.status;
        }
        if (!hasAttribute(Model, "pendingAction")) {
          delete nextBody.pendingAction;
        }
        if (!hasAttribute(Model, "approvalNote")) {
          delete nextBody.approvalNote;
        }
        if (!hasAttribute(Model, "requestedByUserId")) {
          delete nextBody.requestedByUserId;
        }
        req.body = nextBody;
        return next();
      }

      if (req.method === "PUT" || req.method === "PATCH") {
        const nextBody = applyUpdateWorkflow(req.body || {}, req.user || {}, {
          privilegedRoles: updatePrivilegedRoles,
        });

        if (!hasAttribute(Model, "status")) {
          delete nextBody.status;
        }

        if (!hasAttribute(Model, "pendingAction")) {
          delete nextBody.pendingAction;
        }

        if (hasAttribute(Model, "approvalNote")) {
          // keep
        } else if (hasAttribute(Model, "note")) {
          const incomingNote =
            req.body?.note !== undefined
              ? req.body.note
              : req.body?.approvalNote;
          nextBody.note = buildPendingUpdateNote(incomingNote);
          delete nextBody.approvalNote;
        } else {
          delete nextBody.approvalNote;
        }

        if (!hasAttribute(Model, "requestedByUserId")) {
          delete nextBody.requestedByUserId;
        }

        req.body = nextBody;
        return next();
      }

      if (req.method !== "DELETE") {
        return next();
      }

      if (isPrivilegedRole(req.user?.role)) {
        return next();
      }

      const existing = await Model.findOne({ where: { Id: req.params.id } });
      if (!existing) {
        throw new ApiError(404, `${entityLabel || "Record"} not found`);
      }

      // Ownership guard: employees can only request delete for their own KPI rows.
      if (
        resolvedModelKey === "kpi" &&
        req.user?.role === ENUM_USER_ROLE.EMPLOYEE &&
        hasAttribute(Model, "userId") &&
        Number(existing.userId) !== Number(req.user?.Id)
      ) {
        const employeeProfile = hasAttribute(Model, "employeeId")
          ? await db.employeeList.findOne({
              where: { userId: req.user?.Id },
              attributes: ["Id"],
            })
          : null;

        if (
          !employeeProfile ||
          Number(employeeProfile.Id) !== Number(existing.employeeId)
        ) {
          throw new ApiError(403, "You can only request delete for your own KPI");
        }
      }

      const workflowPayload = buildDeleteWorkflowPayload(
        readDeleteNote(req),
        req.user,
      );
      const updatePayload = {};

      if (hasAttribute(Model, "status")) {
        updatePayload.status = hasAttribute(Model, "pendingAction")
          ? "Pending"
          : "Pending Delete";
      }

      if (hasAttribute(Model, "pendingAction")) {
        updatePayload.pendingAction = workflowPayload.pendingAction;
      }

      if (hasAttribute(Model, "approvalNote")) {
        updatePayload.approvalNote = workflowPayload.approvalNote;
      } else if (hasAttribute(Model, "note")) {
        updatePayload.note = workflowPayload.approvalNote;
      }

      if (hasAttribute(Model, "requestedByUserId")) {
        updatePayload.requestedByUserId = workflowPayload.requestedByUserId;
      }

      await Model.update(updatePayload, {
        where: { Id: req.params.id },
      });

      // Notify privileged users about delete requests.
      {
        const privilegedUsers = await User.findAll({
          attributes: ["Id", "role"],
          where: {
            Id: { [Op.ne]: req.user?.Id || null },
            role: {
              [Op.in]: [ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN],
            },
          },
        });

        if (privilegedUsers.length) {
          const noteText = workflowPayload?.approvalNote || "";
          const message = noteText
            ? `${entityLabel || "Record"} delete request: ${noteText}`
            : `${entityLabel || "Record"} delete request submitted`;

          const bookId =
            hasAttribute(Model, "bookId") && existing?.bookId
              ? existing.bookId
              : null;

          const url =
            resolvedModelKey === "cashInOut" && bookId
              ? `/book/${bookId}`
              : resolvedModelKey === "cashInOut"
                ? `/cash-in-out`
                : `${req.baseUrl || ""}`;

          await Promise.all(
            privilegedUsers.map((u) =>
              Notification.create({
                userId: u.Id,
                message,
                url,
              }),
            ),
          );
        }
      }

      const updated = await Model.findOne({ where: { Id: req.params.id } });

      return res.status(200).json({
        success: true,
        message: `${entityLabel || "Record"} delete request submitted for approval`,
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  };

// Approval rules for everything except requisitions:
//  - Create: non-approvers' back-dated entries are Pending (unchanged).
//  - Edit/Delete by admin, superAdmin or a department head: applied directly, Active.
//  - Edit/Delete by anyone else: the record turns Pending / Pending Delete and
//    the request waits in ApprovalRequests. Approve applies it, reject puts the
//    record back as it was (app/modules/approval).
const STRIPPED_WORKFLOW_FIELDS = ["pendingAction", "approvalNote", "requestedByUserId"];

const stripWorkflowFields = (Model, body) => {
  const next = { ...body };
  STRIPPED_WORKFLOW_FIELDS.forEach((field) => {
    if (!hasAttribute(Model, field)) delete next[field];
  });
  if (!hasAttribute(Model, "status")) delete next.status;
  return next;
};

// Services read `actorRole` from the body to decide whether a change may skip
// approval; it is set here from the signed-in user, never trusted from the form.
const approverActorRole = (user) =>
  [ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN].includes(user?.role)
    ? user.role
    : ENUM_USER_ROLE.ADMIN;

// An approver's own edit ends up Active unless they chose another real status
// (e.g. Inactive on a master record).
const approverStatus = (status) => {
  const value = String(status || "").trim();
  return value && !/^pending/i.test(value) ? value : "Active";
};

const fileMeta = (file) =>
  file
    ? {
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        destination: file.destination,
        filename: file.filename,
        path: file.path,
        size: file.size,
      }
    : null;

const submitApprovalRequest = async ({ req, Model, modelKey, entityLabel, action }) => {
  const recordId = Number(req.params.id);
  const existing = await Model.findOne({ where: { Id: recordId } });
  if (!existing) {
    throw new ApiError(404, `${entityLabel || "Record"} not found`);
  }
  if (await findOpenRequest(modelKey, recordId)) {
    throw new ApiError(
      409,
      `This ${entityLabel || "record"} is already waiting for approval`,
    );
  }

  const reason = action === "Delete" ? String(readDeleteNote(req) || "").trim() : "";
  const { actorRole: _ignored, ...body } = req.body || {};

  const request = await db.approvalRequest.create({
    modelKey,
    entityLabel: entityLabel || modelKey,
    recordId,
    action,
    payload: action === "Update" ? { body, file: fileMeta(req.file) } : null,
    method: req.method,
    url: `${req.baseUrl}${req.path}`,
    previousStatus: hasAttribute(Model, "status") ? existing.status : null,
    previousNote: hasAttribute(Model, "note") ? existing.note : null,
    reason: reason || null,
    requestedByUserId: req.user?.Id || null,
  });

  if (hasAttribute(Model, "status")) {
    const flag = { status: action === "Delete" ? "Pending Delete" : "Pending" };
    // Delete reasons were always shown in the record's note; reject restores the old one.
    if (reason && hasAttribute(Model, "note")) flag.note = reason;
    await Model.update(flag, { where: { Id: recordId } });
    await rebuildAssetsIfNeeded(modelKey);
  }

  const requester = [req.user?.FirstName, req.user?.LastName].filter(Boolean).join(" ") || "A user";
  const notifications = await notifyApprovers(
    `${requester} requested to ${action === "Delete" ? "delete" : "edit"} a ${entityLabel || "record"} — awaiting approval`,
    req.user?.Id,
  );
  await request.update({ notificationIds: notifications.map((row) => row.id) });

  return Model.findOne({ where: { Id: recordId } });
};

const applyApprovalWorkflow = ({ modelKey, entityLabel, updatePrivilegedRoles }) => {
  registerWorkflowModel(modelKey, entityLabel);
  const legacy = legacyApprovalWorkflow({ modelKey, entityLabel, updatePrivilegedRoles });

  const middleware = async (req, res, next) => {
    try {
      const resolvedModelKey = resolveWorkflowModelKey(modelKey, req);
      if (REQUISITION_MODEL_KEYS.has(resolvedModelKey)) {
        return legacy(req, res, next);
      }
      registerWorkflowModel(resolvedModelKey, entityLabel);

      const Model = db[resolvedModelKey];
      if (!Model) {
        throw new ApiError(
          500,
          `${entityLabel || resolvedModelKey} workflow model not found`,
        );
      }

      const approver = await isApprover(req.user);

      if (req.method === "POST") {
        const nextBody = applyCreateWorkflow(req.body || {}, req.user || {}, {
          hasDateField: hasAttribute(Model, "date"),
          privileged: approver,
        });
        nextBody.actorRole = approver ? approverActorRole(req.user) : req.user?.role;
        req.body = stripWorkflowFields(Model, nextBody);
        return next();
      }

      if (!["PUT", "PATCH", "DELETE"].includes(req.method)) {
        return next();
      }

      if (approver) {
        if (req.method !== "DELETE") {
          req.body = stripWorkflowFields(Model, {
            ...(req.body || {}),
            status: approverStatus(req.body?.status),
            pendingAction: null,
            approvalNote: null,
            requestedByUserId: null,
            actorRole: approverActorRole(req.user),
          });
        }
        await closeOpenRequests(
          resolvedModelKey,
          req.params.id,
          req.user?.Id,
          req.method === "DELETE" ? "Deleted by an approver" : "Edited directly by an approver",
        );
        return next();
      }

      // Ownership guard: employees can only request delete for their own KPI rows.
      if (
        req.method === "DELETE" &&
        resolvedModelKey === "kpi" &&
        req.user?.role === ENUM_USER_ROLE.EMPLOYEE
      ) {
        const existing = await Model.findOne({ where: { Id: req.params.id } });
        if (existing && Number(existing.userId) !== Number(req.user?.Id)) {
          const employeeProfile = await db.employeeList.findOne({
            where: { userId: req.user?.Id },
            attributes: ["Id"],
          });
          if (!employeeProfile || Number(employeeProfile.Id) !== Number(existing.employeeId)) {
            throw new ApiError(403, "You can only request delete for your own KPI");
          }
        }
      }

      const action = req.method === "DELETE" ? "Delete" : "Update";
      const record = await submitApprovalRequest({
        req,
        Model,
        modelKey: resolvedModelKey,
        entityLabel,
        action,
      });

      return res.status(200).json({
        success: true,
        message: `${entityLabel || "Record"} ${action === "Delete" ? "delete" : "update"} request submitted for approval`,
        data: record,
      });
    } catch (error) {
      return next(error);
    }
  };

  // Lets the Approvals API find the update route to replay an approved edit.
  middleware.isApprovalWorkflow = true;
  return middleware;
};

const approvePendingWorkflow =
  ({ modelKey, entityLabel }) =>
  async (req, res, next) => {
    try {
      const resolvedModelKey = resolveWorkflowModelKey(modelKey, req);
      const Model = db[resolvedModelKey];
      if (!Model) {
        throw new ApiError(
          500,
          `${entityLabel || resolvedModelKey} workflow model not found`,
        );
      }

      const existing = await Model.findOne({ where: { Id: req.params.id } });
      if (!existing) {
        throw new ApiError(404, `${entityLabel || "Record"} not found`);
      }

      // An edit/delete waiting in ApprovalRequests is applied by the Approvals service.
      const openRequest = !REQUISITION_MODEL_KEYS.has(resolvedModelKey)
        ? await findOpenRequest(resolvedModelKey, req.params.id)
        : null;
      if (openRequest) {
        const result = await require("../modules/approval/approval.service").approve(
          `request-${openRequest.Id}`,
          req.user,
          req,
        );
        return res.status(200).json({
          success: true,
          message: `${entityLabel || "Record"} approved successfully`,
          data: { ...result, workflowAction: result.status === "Deleted" ? "deleted" : "approved" },
        });
      }

      if (
        existing.pendingAction === "Delete" ||
        existing.status === "Pending Delete"
      ) {
        const deleteService = stockDeleteService(resolvedModelKey);
        if (deleteService) {
          await deleteService.deleteIdFromDB(req.params.id);
        } else {
          await Model.destroy({ where: { Id: req.params.id } });
        }
        if (
          ["assetsPurchase", "assetsSale", "assetsDamage"].includes(
            resolvedModelKey,
          )
        ) {
          await db.sequelize.transaction(async (t) => {
            await rebuildAssetsStockBalances(t);
          });
        }
        return res.status(200).json({
          success: true,
          message: `${entityLabel || "Record"} deleted successfully`,
          data: { deleted: true, workflowAction: "deleted" },
        });
      }

      const approvalPayload = {};

      if (hasAttribute(Model, "status")) {
        approvalPayload.status =
          resolvedModelKey === "cashInOut" ? "Approved" : "Active";
      }
      if (hasAttribute(Model, "pendingAction")) {
        approvalPayload.pendingAction = null;
      }
      if (hasAttribute(Model, "approvalNote")) {
        approvalPayload.approvalNote = null;
      } else if (hasAttribute(Model, "note")) {
        approvalPayload.note = null;
      }
      if (hasAttribute(Model, "requestedByUserId")) {
        approvalPayload.requestedByUserId = null;
      }

      await Model.update(approvalPayload, { where: { Id: req.params.id } });

      const updated = await Model.findOne({ where: { Id: req.params.id } });

      if (
        ["assetsPurchase", "assetsSale", "assetsDamage"].includes(
          resolvedModelKey,
        )
      ) {
        await db.sequelize.transaction(async (t) => {
          await rebuildAssetsStockBalances(t);
        });
      }
      if (resolvedModelKey === "pettyCash") {
        await notifyApprovedPettyCash(req);
      }
      if (resolvedModelKey === "assetsRequisition") {
        await notifyApprovedAssetsRequisition(req);
      }

      return res.status(200).json({
        success: true,
        message: `${entityLabel || "Record"} approved successfully`,
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  };

module.exports = {
  applyApprovalWorkflow,
  approvePendingWorkflow,
};

// Shared pieces of the approval workflow, used by the route middleware
// (app/middlewares/approvalRouteWorkflow.js) and the Approvals API.
const { Op } = require("sequelize");
const db = require("../../../models");
const { ENUM_USER_ROLE } = require("../../enums/user");
const {
  rebuildAssetsStockBalances,
} = require("../assetsStock/assetsStockSync");

// Requisitions are requests by nature — they keep their own Pending → Approved
// flow and are not part of the edit/delete approval rules.
const REQUISITION_MODEL_KEYS = new Set([
  "purchaseRequisition",
  "assetsRequisition",
  "itemRequisition",
]);

const ADMIN_ROLES = [ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN];
const ASSET_MODEL_KEYS = ["assetsPurchase", "assetsSale", "assetsDamage"];

// modelKey → entityLabel of every route that runs the workflow; filled when
// the route files load.
const WORKFLOW_MODELS = new Map();
const registerWorkflowModel = (modelKey, entityLabel) => {
  if (typeof modelKey === "string" && db[modelKey] && !WORKFLOW_MODELS.has(modelKey)) {
    WORKFLOW_MODELS.set(modelKey, entityLabel || modelKey);
  }
};

const hasAttribute = (Model, field) => Boolean(Model?.rawAttributes?.[field]);

// Department heads are the departments' team leaders.
const getDepartmentHeadIds = async () => {
  const rows = await db.department.findAll({
    where: { teamLeaderUserId: { [Op.ne]: null } },
    attributes: ["teamLeaderUserId"],
    raw: true,
  });
  return [...new Set(rows.map((row) => Number(row.teamLeaderUserId)).filter(Boolean))];
};

// Admin, superAdmin and department heads edit/delete directly and approve others' requests.
const isApprover = async (user) => {
  if (!user?.Id) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;
  return (await getDepartmentHeadIds()).includes(Number(user.Id));
};

const getApproverUserIds = async () => {
  const [admins, heads] = await Promise.all([
    db.user.findAll({
      where: { role: { [Op.in]: ADMIN_ROLES } },
      attributes: ["Id"],
      raw: true,
    }),
    getDepartmentHeadIds(),
  ]);
  return [...new Set([...admins.map((row) => Number(row.Id)), ...heads])];
};

const notifyUsers = async (userIds, message, url = "approvals") => {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];
  // One create per user (not bulkCreate) so the email/SMS afterCreate hook fires.
  return Promise.all(
    ids.map((userId) =>
      db.notification.create({ userId, message: String(message).slice(0, 250), url }),
    ),
  );
};

// Returns the created notifications so a request can clear them later.
const notifyApprovers = async (message, exceptUserId) =>
  notifyUsers(
    (await getApproverUserIds()).filter((id) => id !== Number(exceptUserId)),
    message,
  );

// Records that move stock must be deleted through their own service, which
// puts the stock back and logs the StockMovement — a bare Model.destroy would
// drop the document but leave its stock effect in place. Required lazily to
// avoid require cycles with the services.
const STOCK_DELETE_SERVICES = [
  "receivedProduct", "inTransitProduct", "returnProduct", "purchaseReturnProduct",
  "posReport", "damageProduct", "damageRepair", "damageRepaired", "mixer",
  "manufacture", "stockAdjustment", "factoryStockAdjustment", "packagingItemPurchase",
  "packagingItemStockAdjustment", "packagingFactoryStockAdjustment",
];
// Same idea for documents whose delete must also clear a linked ledger row
// (Item Requisition → its supplier due; DM Expense Cash In → its dollar
// supplier due).
const LINKED_DELETE_SERVICE_PATHS = {
  itemRequisition: "../itemRequision/itemRequision.service",
  marketingExpense: "../marketingExpense/marketingExpense.service",
};
const stockDeleteService = (modelKey) => {
  if (LINKED_DELETE_SERVICE_PATHS[modelKey]) {
    return require(LINKED_DELETE_SERVICE_PATHS[modelKey]);
  }
  return STOCK_DELETE_SERVICES.includes(modelKey)
    ? require(`../${modelKey}/${modelKey}.service`)
    : null;
};

const rebuildAssetsIfNeeded = async (modelKey) => {
  if (!ASSET_MODEL_KEYS.includes(modelKey)) return;
  await db.sequelize.transaction(async (t) => {
    await rebuildAssetsStockBalances(t);
  });
};

const deleteWorkflowRecord = async (modelKey, id) => {
  const deleteService = stockDeleteService(modelKey);
  if (deleteService) {
    await deleteService.deleteIdFromDB(id);
  } else {
    await db[modelKey].destroy({ where: { Id: id } });
  }
  await rebuildAssetsIfNeeded(modelKey);
};

const findOpenRequest = (modelKey, recordId) =>
  db.approvalRequest.findOne({
    where: { modelKey, recordId: Number(recordId), status: "Pending" },
  });

// MariaDB hands JSON columns back as text.
const parseIds = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Once one approver decides, the request's notification is done for every approver.
const markRequestNotificationsRead = async (requests) => {
  const ids = [requests].flat().flatMap((request) => parseIds(request?.notificationIds));
  if (!ids.length) return;
  await db.notification.update({ isRead: true }, { where: { id: { [Op.in]: ids } } });
};

// An approver changed or deleted the record directly: earlier requests on it are void.
const closeOpenRequests = async (modelKey, recordId, userId, note) => {
  const where = { modelKey, recordId: Number(recordId), status: "Pending" };
  const open = await db.approvalRequest.findAll({ where, attributes: ["Id", "notificationIds"], raw: true });
  if (!open.length) return;
  await db.approvalRequest.update(
    {
      status: "Rejected",
      resolvedByUserId: userId || null,
      resolvedAt: new Date(),
      resolutionNote: note,
    },
    { where },
  );
  await markRequestNotificationsRead(open);
};

module.exports = {
  ADMIN_ROLES,
  REQUISITION_MODEL_KEYS,
  WORKFLOW_MODELS,
  registerWorkflowModel,
  hasAttribute,
  isApprover,
  getApproverUserIds,
  notifyUsers,
  notifyApprovers,
  stockDeleteService,
  rebuildAssetsIfNeeded,
  deleteWorkflowRecord,
  findOpenRequest,
  closeOpenRequests,
  markRequestNotificationsRead,
};

const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ProfitLossController = require("./profitLoss.controller");
const router = require("express").Router();

const profitLossPermissionByMode = {
  product: "profit_loss",
  auto: "auto_profit_loss",
  user: "profit_loss_user",
};

const profitLossPermissions = [
  "profit_loss",
  "auto_profit_loss",
  "profit_loss_user",
];

const profitLossModelKeyByMode = {
  auto: "autoProfitLoss",
  user: "userProfitLoss",
  product: "profitLoss",
};

const resolveProfitLossModelKey = (req) =>
  profitLossModelKeyByMode[req.body?.mode || req.query?.mode] || "profitLoss";

const requireProfitLossPermission = (req, res, next) => {
  const mode = req.body?.mode || req.query?.mode;
  const requiredPermission = profitLossPermissionByMode[mode];

  return requiredPermission
    ? requireMenuPermission(requiredPermission)(req, res, next)
    : requireAnyPermission(profitLossPermissions)(req, res, next);
};

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireProfitLossPermission,
  applyApprovalWorkflow({
    modelKey: resolveProfitLossModelKey,
    entityLabel: "Daily Profit & Loss",
  }),
  ProfitLossController.insertIntoDB,
);
router.post(
  "/invoice",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireProfitLossPermission,
  ProfitLossController.sendInvoiceEmail,
);
router.get(
  "/",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireProfitLossPermission,
  ProfitLossController.getAllFromDB,
);
router.get(
  "/all",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(profitLossPermissions),
  ProfitLossController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(profitLossPermissions),
  ProfitLossController.getDataById,
);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(profitLossPermissions),
  applyApprovalWorkflow({
    modelKey: resolveProfitLossModelKey,
    entityLabel: "Daily Profit & Loss",
  }),
  ProfitLossController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(profitLossPermissions),
  applyApprovalWorkflow({
    modelKey: resolveProfitLossModelKey,
    entityLabel: "Daily Profit & Loss",
  }),
  ProfitLossController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(profitLossPermissions),
  approvePendingWorkflow({
    modelKey: resolveProfitLossModelKey,
    entityLabel: "Daily Profit & Loss",
  }),
);

const ProfitLossRoutes = router;
module.exports = ProfitLossRoutes;

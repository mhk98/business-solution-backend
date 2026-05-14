const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ProfitLossController = require("./profitLoss.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("profit_loss"),
  applyApprovalWorkflow({ modelKey: "profitLoss", entityLabel: "Daily Profit & Loss" }),
  ProfitLossController.insertIntoDB,
);
router.post(
  "/invoice",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  requireMenuPermission("profit_loss"),
  ProfitLossController.sendInvoiceEmail,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("profit_loss"),
  ProfitLossController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("profit_loss"),
  ProfitLossController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("profit_loss"),
  ProfitLossController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("profit_loss"),
  applyApprovalWorkflow({ modelKey: "profitLoss", entityLabel: "Daily Profit & Loss" }),
  ProfitLossController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("profit_loss"),
  applyApprovalWorkflow({ modelKey: "profitLoss", entityLabel: "Daily Profit & Loss" }),
  ProfitLossController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("profit_loss"),
  approvePendingWorkflow({ modelKey: "profitLoss", entityLabel: "Daily Profit & Loss" }),
);

const ProfitLossRoutes = router;
module.exports = ProfitLossRoutes;

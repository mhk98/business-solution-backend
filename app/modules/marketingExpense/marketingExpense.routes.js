const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const MarketingExpenseController = require("./marketingExpense.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  applyApprovalWorkflow({ modelKey: "marketingExpense", entityLabel: "DM Expense" }),
  MarketingExpenseController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getAllFromDB,
);
router.get(
  "/summary",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getOverviewSummaryFromDB,
);
router.get(
  "/all",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  applyApprovalWorkflow({ modelKey: "marketingExpense", entityLabel: "DM Expense" }),
  MarketingExpenseController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  applyApprovalWorkflow({ modelKey: "marketingExpense", entityLabel: "DM Expense" }),
  MarketingExpenseController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(["marketing", "dm_expense"]),
  approvePendingWorkflow({ modelKey: "marketingExpense", entityLabel: "DM Expense" }),
);
const MarketingExpenseRoutes = router;
module.exports = MarketingExpenseRoutes;

const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const StockAdjustmentController = require("./stockAdjustment.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "stockAdjustment", entityLabel: "Stock Adjustment" }),
  StockAdjustmentController.insertIntoDB,
);
router.get("/", auth(), StockAdjustmentController.getAllFromDB);
router.get("/all", auth(), StockAdjustmentController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), StockAdjustmentController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "stockAdjustment", entityLabel: "Stock Adjustment" }),
  StockAdjustmentController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "stockAdjustment", entityLabel: "Stock Adjustment" }),
  StockAdjustmentController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "stockAdjustment", entityLabel: "Stock Adjustment" }),
);

const StockAdjustmentRoutes = router;
module.exports = StockAdjustmentRoutes;

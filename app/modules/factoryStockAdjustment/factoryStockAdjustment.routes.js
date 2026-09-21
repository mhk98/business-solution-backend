const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const FactoryStockAdjustmentController = require("./factoryStockAdjustment.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({
    modelKey: "factoryStockAdjustment",
    entityLabel: "Factory Stock Adjustment",
  }),
  FactoryStockAdjustmentController.insertIntoDB,
);
router.get("/", auth(), FactoryStockAdjustmentController.getAllFromDB);
router.get(
  "/all",
  auth(),
  FactoryStockAdjustmentController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), FactoryStockAdjustmentController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "factoryStockAdjustment",
    entityLabel: "Factory Stock Adjustment",
  }),
  FactoryStockAdjustmentController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({
    modelKey: "factoryStockAdjustment",
    entityLabel: "Factory Stock Adjustment",
  }),
  FactoryStockAdjustmentController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({
    modelKey: "factoryStockAdjustment",
    entityLabel: "Factory Stock Adjustment",
  }),
);

const FactoryStockAdjustmentRoutes = router;
module.exports = FactoryStockAdjustmentRoutes;

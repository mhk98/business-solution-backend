const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PackagingFactoryStockAdjustmentController = require("./packagingFactoryStockAdjustment.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("packaging_factory_stock_adjustment"),
  applyApprovalWorkflow({
    modelKey: "packagingFactoryStockAdjustment",
    entityLabel: "Packaging Factory Stock Adjustment",
  }),
  PackagingFactoryStockAdjustmentController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("packaging_factory_stock_adjustment"),
  PackagingFactoryStockAdjustmentController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("packaging_factory_stock_adjustment"),
  PackagingFactoryStockAdjustmentController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("packaging_factory_stock_adjustment"),
  PackagingFactoryStockAdjustmentController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("packaging_factory_stock_adjustment"),
  applyApprovalWorkflow({
    modelKey: "packagingFactoryStockAdjustment",
    entityLabel: "Packaging Factory Stock Adjustment",
  }),
  PackagingFactoryStockAdjustmentController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("packaging_factory_stock_adjustment"),
  applyApprovalWorkflow({
    modelKey: "packagingFactoryStockAdjustment",
    entityLabel: "Packaging Factory Stock Adjustment",
  }),
  PackagingFactoryStockAdjustmentController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("packaging_factory_stock_adjustment"),
  approvePendingWorkflow({
    modelKey: "packagingFactoryStockAdjustment",
    entityLabel: "Packaging Factory Stock Adjustment",
  }),
);

const PackagingFactoryStockAdjustmentRoutes = router;
module.exports = PackagingFactoryStockAdjustmentRoutes;

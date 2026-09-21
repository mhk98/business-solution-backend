const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PackagingItemStockAdjustmentController = require("./packagingItemStockAdjustment.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("packaging_item_stock_adjustment"),
  applyApprovalWorkflow({
    modelKey: "packagingItemStockAdjustment",
    entityLabel: "Packaging Item Stock Adjustment",
  }),
  PackagingItemStockAdjustmentController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("packaging_item_stock_adjustment"),
  PackagingItemStockAdjustmentController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("packaging_item_stock_adjustment"),
  PackagingItemStockAdjustmentController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("packaging_item_stock_adjustment"),
  PackagingItemStockAdjustmentController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("packaging_item_stock_adjustment"),
  applyApprovalWorkflow({
    modelKey: "packagingItemStockAdjustment",
    entityLabel: "Packaging Item Stock Adjustment",
  }),
  PackagingItemStockAdjustmentController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("packaging_item_stock_adjustment"),
  applyApprovalWorkflow({
    modelKey: "packagingItemStockAdjustment",
    entityLabel: "Packaging Item Stock Adjustment",
  }),
  PackagingItemStockAdjustmentController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("packaging_item_stock_adjustment"),
  approvePendingWorkflow({
    modelKey: "packagingItemStockAdjustment",
    entityLabel: "Packaging Item Stock Adjustment",
  }),
);

const PackagingItemStockAdjustmentRoutes = router;
module.exports = PackagingItemStockAdjustmentRoutes;

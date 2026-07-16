const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PackagingItemPurchaseController = require("./packagingItemPurchase.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("packaging_item_purchase"),
  applyApprovalWorkflow({
    modelKey: "packagingItemPurchase",
    entityLabel: "Packaging Item Purchase",
  }),
  PackagingItemPurchaseController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("packaging_item_purchase"),
  PackagingItemPurchaseController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("packaging_item_purchase"),
  PackagingItemPurchaseController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("packaging_item_purchase"),
  PackagingItemPurchaseController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("packaging_item_purchase"),
  applyApprovalWorkflow({
    modelKey: "packagingItemPurchase",
    entityLabel: "Packaging Item Purchase",
  }),
  PackagingItemPurchaseController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("packaging_item_purchase"),
  applyApprovalWorkflow({
    modelKey: "packagingItemPurchase",
    entityLabel: "Packaging Item Purchase",
  }),
  PackagingItemPurchaseController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("packaging_item_purchase"),
  approvePendingWorkflow({
    modelKey: "packagingItemPurchase",
    entityLabel: "Packaging Item Purchase",
  }),
);

module.exports = router;

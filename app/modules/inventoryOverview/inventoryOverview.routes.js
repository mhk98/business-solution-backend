const router = require("express").Router();
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const InventoryOverviewController = require("./inventoryOverview.controller");

// ✅ LIST (UI table এর জন্য)
router.get(
  "/list",
  auth(),
  requireMenuPermission("inventory_overview"),
  InventoryOverviewController.getInventoryOverviewList,
);

// ✅ SUMMARY (cards এর জন্য)
router.get(
  "/summary",
  auth(),
  requireMenuPermission("inventory_overview"),
  InventoryOverviewController.getInventoryOverviewSummary,
);

module.exports = router;

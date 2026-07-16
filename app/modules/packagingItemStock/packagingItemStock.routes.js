const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const PackagingItemStockController = require("./packagingItemStock.controller");
const router = require("express").Router();

router.get(
  "/",
  auth(),
  requireMenuPermission("packaging_item_stock"),
  PackagingItemStockController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("packaging_item_stock"),
  PackagingItemStockController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("packaging_item_stock"),
  PackagingItemStockController.getDataById,
);

module.exports = router;

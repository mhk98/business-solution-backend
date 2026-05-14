const router = require("express").Router();
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const AssetsStockController = require("./assetsStock.controller");

router.get(
  "/",
  auth(),
  requireMenuPermission("assets_stock"),
  AssetsStockController.getAllFromDB,
);

router.get(
  "/all",
  auth(),
  requireMenuPermission("assets_stock"),
  AssetsStockController.getAllFromDBWithoutQuery,
);

module.exports = router;

const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const PackagingFactoryStockController = require("./packagingFactoryStock.controller");
const router = require("express").Router();

router.get("/", auth(), requireMenuPermission("packaging_factory_stock"), PackagingFactoryStockController.getAllFromDB);
router.get("/all", auth(), requireMenuPermission("packaging_factory_stock"), PackagingFactoryStockController.getAllFromDBWithoutQuery);

module.exports = router;

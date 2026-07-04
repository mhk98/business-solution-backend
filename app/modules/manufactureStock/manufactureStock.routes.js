const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const ManufactureStockController = require("./manufactureStock.controller");
const router = require("express").Router();

router.get(
  "/",
  auth(),
  requireMenuPermission("manufacture_stock"),
  ManufactureStockController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("manufacture_stock"),
  ManufactureStockController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("manufacture_stock"),
  ManufactureStockController.getDataById,
);

const ManufactureStockRoutes = router;
module.exports = ManufactureStockRoutes;

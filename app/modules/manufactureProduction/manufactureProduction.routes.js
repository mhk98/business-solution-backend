const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const ManufactureProductionController = require("./manufactureProduction.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireMenuPermission("manufacture_menu"),
  ManufactureProductionController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("manufacture_menu"),
  ManufactureProductionController.getAllFromDB,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("manufacture_menu"),
  ManufactureProductionController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("manufacture_menu"),
  ManufactureProductionController.updateOneFromDB,
);

const ManufactureProductionRoutes = router;
module.exports = ManufactureProductionRoutes;

const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const InventoryMasterController = require("./inventoryMaster.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  requireMenuPermission("inventory"),
  InventoryMasterController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("inventory"),
  InventoryMasterController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("inventory"),
  InventoryMasterController.getAllFromDBWithoutQuery,
);
router.get(
  "/low-stock",
  auth(),
  requireMenuPermission("inventory"),
  InventoryMasterController.getLowStockProducts,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("inventory"),
  InventoryMasterController.getDataById,
);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("inventory"),
  InventoryMasterController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  requireMenuPermission("inventory"),
  InventoryMasterController.updateOneFromDB,
);

const InventoryMasterRoutes = router;
module.exports = InventoryMasterRoutes;

const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const DamageReparingStockController = require("./damageReparingStock.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageReparingStockController.insertIntoDB,
);
router.get("/", auth(), DamageReparingStockController.getAllFromDB);
router.get("/all", auth(), DamageReparingStockController.getAllFromDBWithoutQuery);
router.get("/", auth(), DamageReparingStockController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  DamageReparingStockController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageReparingStockController.updateOneFromDB,
);

const DamageReparingStockRoutes = router;
module.exports = DamageReparingStockRoutes;

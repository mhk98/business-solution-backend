const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const DamageStockController = require("./damageStock.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageStockController.insertIntoDB,
);
router.get("/", auth(), DamageStockController.getAllFromDB);
router.get("/all", auth(), DamageStockController.getAllFromDBWithoutQuery);
router.get("/", auth(), DamageStockController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  DamageStockController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageStockController.updateOneFromDB,
);

const DamageStockRoutes = router;
module.exports = DamageStockRoutes;

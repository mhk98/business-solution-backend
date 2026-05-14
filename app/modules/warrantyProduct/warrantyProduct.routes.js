const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const WarrantyProductController = require("./warrantyProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  WarrantyProductController.insertIntoDB,
);
router.get("/", auth(), WarrantyProductController.getAllFromDB);
router.get("/all", auth(), WarrantyProductController.getAllFromDBWithoutQuery);
router.get("/", auth(), WarrantyProductController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  WarrantyProductController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  WarrantyProductController.updateOneFromDB,
);

const WarrantyProductRoutes = router;
module.exports = WarrantyProductRoutes;

const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ItemMasterController = require("./itemMaster.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ItemMasterController.insertIntoDB,
);
router.get("/", auth(), ItemMasterController.getAllFromDB);
router.get("/all", auth(), ItemMasterController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), ItemMasterController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ItemMasterController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ItemMasterController.updateOneFromDB,
);

const ItemMasterRoutes = router;
module.exports = ItemMasterRoutes;

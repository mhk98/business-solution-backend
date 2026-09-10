const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const DollarSupplierHistoryController = require("./dollarSupplierHistory.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DollarSupplierHistoryController.insertIntoDB,
);
router.get("/", auth(), DollarSupplierHistoryController.getAllFromDB);
router.get(
  "/all",
  auth(),
  DollarSupplierHistoryController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), DollarSupplierHistoryController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  DollarSupplierHistoryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DollarSupplierHistoryController.updateOneFromDB,
);

const DollarSupplierHistoryRoutes = router;
module.exports = DollarSupplierHistoryRoutes;

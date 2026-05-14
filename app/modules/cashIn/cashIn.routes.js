const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const CashInController = require("./cashIn.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  CashInController.insertIntoDB,
);
router.get("/", auth(), CashInController.getAllFromDB);
router.get("/all", auth(), CashInController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), CashInController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  CashInController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  CashInController.updateOneFromDB,
);
const CashInRoutes = router;
module.exports = CashInRoutes;

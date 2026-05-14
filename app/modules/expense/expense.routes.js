const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ExpenseController = require("./expense.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ExpenseController.insertIntoDB,
);
router.get("/", auth(), ExpenseController.getAllFromDB);
router.get("/all", auth(), ExpenseController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), ExpenseController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ExpenseController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ExpenseController.updateOneFromDB,
);
const ExpenseRoutes = router;
module.exports = ExpenseRoutes;

const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const BankAccountController = require("./bankAccount.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  BankAccountController.insertIntoDB,
);
router.get("/", auth(), BankAccountController.getAllFromDB);
router.get("/all", auth(), BankAccountController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), BankAccountController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  BankAccountController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  BankAccountController.updateOneFromDB,
);

const BankAccountRoutes = router;
module.exports = BankAccountRoutes;

const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const SystemResetController = require("./systemReset.controller");

router.post(
  "/data",
  auth(ENUM_USER_ROLE.SUPER_ADMIN),
  SystemResetController.resetData,
);

module.exports = router;

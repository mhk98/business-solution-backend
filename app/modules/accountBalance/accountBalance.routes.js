const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const AccountBalanceController = require("./accountBalance.controller");
const router = require("express").Router();

router.get(
  "/",
  auth(),
  requireMenuPermission("account_balance"),
  AccountBalanceController.getSummary,
);

module.exports = router;

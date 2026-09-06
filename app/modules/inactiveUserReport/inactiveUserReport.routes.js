const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const InactiveUserReportController = require("./inactiveUserReport.controller");

router.get(
  "/",
  auth(ENUM_USER_ROLE.SUPER_ADMIN),
  requireMenuPermission("daily_inactive_users"),
  InactiveUserReportController.getReport,
);

router.get(
  "/activity",
  auth(ENUM_USER_ROLE.SUPER_ADMIN),
  requireMenuPermission("daily_inactive_users"),
  InactiveUserReportController.getUserDayActivity,
);

module.exports = router;

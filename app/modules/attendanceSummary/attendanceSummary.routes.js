const router = require("express").Router();
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const AttendanceSummaryController = require("./attendanceSummary.controller");

router.get(
  "/",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceSummaryController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceSummaryController.getAllFromDBWithoutQuery,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission(["employee_profile", "attendance"]),
  AttendanceSummaryController.getMyAttendanceSummary,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceSummaryController.getDataById,
);

module.exports = router;

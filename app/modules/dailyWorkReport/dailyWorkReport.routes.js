const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");
const DailyWorkReportController = require("./dailyWorkReport.controller");

const router = require("express").Router();
const dailyWorkReportPermissions = ["daily_work_reports"];

router.post(
  "/create",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.submitReport,
);
router.post(
  "/upload-proof",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  uploadFile,
  DailyWorkReportController.uploadProof,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getMyReports,
);
router.get(
  "/assigned-tasks",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getAssignedTasksForReport,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.updateMyReport,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.deleteReport,
);
router.get(
  "/leaderboard",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getLeaderboard,
);
router.get(
  "/dashboard/employee",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getEmployeeDashboard,
);
router.get(
  "/dashboard/admin",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getAdminDashboard,
);
router.get(
  "/eligible-submitters",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getEligibleSubmitters,
);
router.post(
  "/:id/calculate-score",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.recalculatePerformanceScore,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getAllReports,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.getDataById,
);
router.put(
  "/:id/review",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.reviewReport,
);
router.post(
  "/send-reminders",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(dailyWorkReportPermissions),
  DailyWorkReportController.sendPendingReminders,
);

module.exports = router;

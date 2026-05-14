const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");
const DailyWorkReportController = require("./dailyWorkReport.controller");

const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.submitReport,
);
router.post(
  "/upload-proof",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  uploadFile,
  DailyWorkReportController.uploadProof,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getMyReports,
);
router.get(
  "/assigned-tasks",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getAssignedTasksForReport,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.updateMyReport,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.deleteReport,
);
router.get(
  "/leaderboard",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getLeaderboard,
);
router.get(
  "/dashboard/employee",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getEmployeeDashboard,
);
router.get(
  "/dashboard/admin",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(["daily_work_reports", "employee_list", "employee_management"]),
  DailyWorkReportController.getAdminDashboard,
);
router.get(
  "/eligible-submitters",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(["daily_work_reports", "employee_list", "employee_management"]),
  DailyWorkReportController.getEligibleSubmitters,
);
router.post(
  "/:id/calculate-score",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(["daily_work_reports", "employee_list", "employee_management"]),
  DailyWorkReportController.recalculatePerformanceScore,
);
router.get(
  "/",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getAllReports,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getDataById,
);
router.put(
  "/:id/review",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(["daily_work_reports", "employee_list", "employee_management"]),
  DailyWorkReportController.reviewReport,
);
router.post(
  "/send-reminders",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(["daily_work_reports", "employee_list", "employee_management"]),
  DailyWorkReportController.sendPendingReminders,
);

module.exports = router;

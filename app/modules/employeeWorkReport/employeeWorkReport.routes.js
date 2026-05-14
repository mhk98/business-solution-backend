const router = require("express").Router();
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const EmployeeWorkReportController = require("./employeeWorkReport.controller");

const reportPermissions = [
  "cs_work_reports",
  "daily_work_reports",
  "employee_profile",
  "employee_list",
  "employee_management",
];

router.post(
  "/create",
  auth(),
  requireAnyPermission(reportPermissions),
  EmployeeWorkReportController.createReport,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission(reportPermissions),
  EmployeeWorkReportController.getMyReports,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  EmployeeWorkReportController.updateReport,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  EmployeeWorkReportController.deleteReport,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(reportPermissions),
  EmployeeWorkReportController.getAllReports,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  EmployeeWorkReportController.getDataById,
);

module.exports = router;

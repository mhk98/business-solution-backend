const router = require("express").Router();
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const LogisticWorkReportController = require("./logisticWorkReport.controller");

const reportPermissions = [
  "logistic_work_reports",
  "employee_profile",
  "employee_list",
  "employee_management",
];

router.post(
  "/create",
  auth(),
  requireAnyPermission(reportPermissions),
  LogisticWorkReportController.createReport,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission(reportPermissions),
  LogisticWorkReportController.getMyReports,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  LogisticWorkReportController.updateReport,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  LogisticWorkReportController.deleteReport,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(reportPermissions),
  LogisticWorkReportController.getAllReports,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  LogisticWorkReportController.getDataById,
);

module.exports = router;

const router = require("express").Router();
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const ShifaReportController = require("./shifaReport.controller");

const reportPermissions = [
  "shifa",
  "shifa_call_history",
  "shifa_starting_situation",
  "shifa_problem_history",
  "shifa_patient_update",
  "employee_profile",
  "employee_list",
  "employee_management",
];

router.post(
  "/create",
  auth(),
  requireAnyPermission(reportPermissions),
  ShifaReportController.createReport,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission(reportPermissions),
  ShifaReportController.getMyReports,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  ShifaReportController.updateReport,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  ShifaReportController.deleteReport,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(reportPermissions),
  ShifaReportController.getAllReports,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(reportPermissions),
  ShifaReportController.getDataById,
);

module.exports = router;

const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission, requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const AttendanceController = require("./attendance.controller");

const ADMINS = [ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.HR];
const view = [auth(), requireMenuPermission("attendance")];
const manage = [auth(...ADMINS), requireMenuPermission("attendance")];
const shifts = [auth(...ADMINS), requireMenuPermission("shift_management")];

router.get("/daily", ...view, AttendanceController.getDaily);
router.get("/monthly", ...view, AttendanceController.getMonthly);
router.get("/job-card", ...view, AttendanceController.getJobCard);
router.get("/punches", ...view, AttendanceController.getPunches);
router.get("/dashboard", auth(), AttendanceController.getDashboard);
router.get(
  "/people",
  auth(),
  requireAnyPermission(["attendance", "shift_management", "leave_management", "department_management"]),
  AttendanceController.getPeople,
);
router.get("/leave-balance", auth(), requireMenuPermission("leave_management"), AttendanceController.getLeaveBalance);

router.post("/recompute", ...manage, AttendanceController.recompute);
router.post("/manual-punch", ...manage, AttendanceController.addManualPunch);
router.delete("/manual-punch/:id", ...manage, AttendanceController.deleteManualPunch);
router.post("/override", ...manage, AttendanceController.overrideDay);
router.post("/override/clear", ...manage, AttendanceController.clearOverride);

router.get("/shift-assignments", auth(), requireMenuPermission("shift_management"), AttendanceController.listAssignments);
router.post("/shift-assignments", ...shifts, AttendanceController.createAssignments);
router.put("/shift-assignments/:id", ...shifts, AttendanceController.updateAssignment);
router.delete("/shift-assignments/:id", ...shifts, AttendanceController.deleteAssignment);

router.get("/setup", ...manage, AttendanceController.getSetup);
router.put("/setup/employee/:id", ...manage, AttendanceController.updateEmployeeSetup);

router.get("/policy", ...view, AttendanceController.getPolicy);
router.put("/policy", ...manage, AttendanceController.savePolicy);

module.exports = router;

const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission, requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const AttendanceController = require("./attendance.controller");

const ADMINS = [ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.HR];
const view = [auth(), requireMenuPermission("attendance")];
const manage = [auth(...ADMINS), requireMenuPermission("attendance")];
const shifts = [auth(...ADMINS), requireMenuPermission("shift_management")];

// Self service — no menu permission: the person is always the login.
router.get("/me", auth(), AttendanceController.getMyAttendance);
router.post("/me/correction", auth(), AttendanceController.applyMyCorrection);
router.post("/me/correction/:id/cancel", auth(), AttendanceController.cancelMyCorrection);
// Team leaders: their departments only (checked in the service).
router.get("/my-team", auth(), AttendanceController.getMyTeam);
router.get("/my-team/job-card", auth(), AttendanceController.getTeamJobCard);
// HR approves attendance corrections.
router.get("/corrections/approvals", auth(), AttendanceController.getCorrectionApprovals);
router.post("/corrections/:id/decide", auth(), AttendanceController.decideCorrection);

router.get("/daily", ...view, AttendanceController.getDaily);
router.get("/monthly", ...view, AttendanceController.getMonthly);
router.get("/job-card", ...view, AttendanceController.getJobCard);
router.get("/punches", ...view, AttendanceController.getPunches);
router.get("/dashboard", auth(), AttendanceController.getDashboard);
router.get(
  "/people",
  auth(),
  requireAnyPermission([
    "attendance",
    "attendance_setup",
    "attendance_correction",
    "shift_management",
    "leave_management",
    "department_management",
  ]),
  AttendanceController.getPeople,
);
// The Attendance Report has a leave-balance tab too.
router.get("/leave-balance", auth(), requireAnyPermission(["attendance", "leave_management"]), AttendanceController.getLeaveBalance);

router.post("/recompute", ...manage, AttendanceController.recompute);
router.post("/manual-punch", ...manage, AttendanceController.addManualPunch);
router.delete("/manual-punch/:id", ...manage, AttendanceController.deleteManualPunch);
router.post("/override", ...manage, AttendanceController.overrideDay);
router.post("/override/clear", ...manage, AttendanceController.clearOverride);

router.get("/shift-assignments", auth(), requireMenuPermission("shift_management"), AttendanceController.listAssignments);
router.post("/shift-assignments", ...shifts, AttendanceController.createAssignments);
router.put("/shift-assignments/:id", ...shifts, AttendanceController.updateAssignment);
router.delete("/shift-assignments/:id", ...shifts, AttendanceController.deleteAssignment);

const setup = [auth(...ADMINS), requireMenuPermission("attendance_setup")];
// Shift Assignment reads the setup list for its people picker.
router.get("/setup", auth(...ADMINS), requireAnyPermission(["attendance_setup", "shift_management"]), AttendanceController.getSetup);
router.put("/setup/employee/:id", ...setup, AttendanceController.updateEmployeeSetup);

router.get("/policy", auth(), requireAnyPermission(["attendance", "attendance_policy"]), AttendanceController.getPolicy);
router.put("/policy", auth(...ADMINS), requireMenuPermission("attendance_policy"), AttendanceController.savePolicy);

module.exports = router;

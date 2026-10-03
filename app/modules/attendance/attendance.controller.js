const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const AttendanceService = require("./attendance.service");

const respond = (message, handler) =>
  catchAsync(async (req, res) => {
    const data = await handler(req);
    sendResponse(res, { statusCode: 200, success: true, message, data });
  });

module.exports = {
  getDaily: respond("Daily attendance fetched", (req) => AttendanceService.getDaily(req.query)),
  getMonthly: respond("Monthly attendance fetched", (req) => AttendanceService.getMonthly(req.query)),
  getJobCard: respond("Job card fetched", (req) => AttendanceService.getJobCard(req.query)),
  getPunches: respond("Punches fetched", (req) => AttendanceService.getPunches(req.query)),
  getDashboard: respond("Attendance dashboard fetched", (req) => AttendanceService.getDashboard(req.query)),
  getLeaveBalance: respond("Leave balance fetched", (req) => AttendanceService.getLeaveBalance(req.query)),

  recompute: respond("Attendance recomputed", (req) => AttendanceService.recompute(req.body)),
  addManualPunch: respond("Manual punch added", (req) => AttendanceService.addManualPunch(req.body, req.user)),
  deleteManualPunch: respond("Manual punch deleted", (req) => AttendanceService.deleteManualPunch(req.params.id)),
  overrideDay: respond("Attendance day overridden", (req) => AttendanceService.overrideDay(req.body, req.user)),
  clearOverride: respond("Override removed", (req) => AttendanceService.clearOverride(req.body)),

  listAssignments: respond("Shift assignments fetched", (req) => AttendanceService.listAssignments(req.query)),
  createAssignments: respond("Shift assigned", (req) => AttendanceService.createAssignments(req.body, req.user)),
  updateAssignment: respond("Shift assignment updated", (req) =>
    AttendanceService.updateAssignment(req.params.id, req.body),
  ),
  deleteAssignment: respond("Shift assignment deleted", (req) => AttendanceService.deleteAssignment(req.params.id)),

  getSetup: respond("Attendance setup fetched", () => AttendanceService.getSetup()),
  updateEmployeeSetup: respond("Employee attendance setup saved", (req) =>
    AttendanceService.updateEmployeeSetup(req.params.id, req.body),
  ),

  getPolicy: respond("Attendance policy fetched", () => AttendanceService.getPolicyWithShifts()),
  savePolicy: respond("Attendance policy saved", (req) => AttendanceService.savePolicy(req.body, req.user)),
};

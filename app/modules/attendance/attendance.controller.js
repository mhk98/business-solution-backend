const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const AttendanceService = require("./attendance.service");

const respond = (message, handler) =>
  catchAsync(async (req, res) => {
    const data = await handler(req);
    sendResponse(res, { statusCode: 200, success: true, message, data });
  });

// The API names the attendance person `employeeId` / `employeeIds` (a Users
// Id). `userId` can't be used in bodies: the auth middleware fills a missing
// body.userId with the logged-in user's Id.
const person = (src = {}) => {
  const { userId: _injected, employeeId, employeeIds, ...rest } = src;
  return {
    ...rest,
    userId: employeeId ? Number(employeeId) : undefined,
    userIds: Array.isArray(employeeIds) ? employeeIds.map(Number).filter(Boolean) : employeeId ? [Number(employeeId)] : [],
  };
};

module.exports = {
  getDaily: respond("Daily attendance fetched", (req) => AttendanceService.getDaily(req.query)),
  getMonthly: respond("Monthly attendance fetched", (req) => AttendanceService.getMonthly(req.query)),
  getJobCard: respond("Job card fetched", (req) => AttendanceService.getJobCard(person(req.query))),
  getPunches: respond("Punches fetched", (req) => AttendanceService.getPunches(person(req.query))),
  getDashboard: respond("Attendance dashboard fetched", (req) => AttendanceService.getDashboard(req.query)),
  getPeople: respond("Attendance people fetched", (req) => AttendanceService.getPeople(req.query)),
  getLeaveBalance: respond("Leave balance fetched", (req) => AttendanceService.getLeaveBalance(person(req.query))),

  recompute: respond("Attendance recomputed", (req) => AttendanceService.recompute(person(req.body))),
  addManualPunch: respond("Manual punch added", (req) => AttendanceService.addManualPunch(person(req.body), req.user)),
  deleteManualPunch: respond("Manual punch deleted", (req) => AttendanceService.deleteManualPunch(req.params.id)),
  overrideDay: respond("Attendance day overridden", (req) => AttendanceService.overrideDay(person(req.body), req.user)),
  clearOverride: respond("Override removed", (req) => AttendanceService.clearOverride(person(req.body))),

  listAssignments: respond("Shift assignments fetched", (req) => AttendanceService.listAssignments(person(req.query))),
  createAssignments: respond("Shift assigned", (req) => AttendanceService.createAssignments(person(req.body), req.user)),
  updateAssignment: respond("Shift assignment updated", (req) =>
    AttendanceService.updateAssignment(req.params.id, person(req.body)),
  ),
  deleteAssignment: respond("Shift assignment deleted", (req) => AttendanceService.deleteAssignment(req.params.id)),

  getSetup: respond("Attendance setup fetched", () => AttendanceService.getSetup()),
  updateEmployeeSetup: respond("Employee attendance setup saved", (req) =>
    AttendanceService.updateEmployeeSetup(req.params.id, req.body),
  ),

  getPolicy: respond("Attendance policy fetched", () => AttendanceService.getPolicyWithShifts()),
  savePolicy: respond("Attendance policy saved", (req) => AttendanceService.savePolicy(req.body, req.user)),
};

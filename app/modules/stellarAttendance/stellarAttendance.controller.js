const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const StellarAttendanceService = require("./stellarAttendance.service");

const getLogs = catchAsync(async (req, res) => {
  const result = await StellarAttendanceService.fetchLogs(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Stellar attendance logs fetched successfully",
    meta: result.meta,
    data: result,
  });
});

const getUsers = catchAsync(async (req, res) => {
  const result = await StellarAttendanceService.fetchUsers();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Stellar attendance users fetched successfully",
    meta: result.meta,
    data: result,
  });
});

module.exports = {
  getLogs,
  getUsers,
};

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const InactiveUserReportService = require("./inactiveUserReport.service");

const getReport = catchAsync(async (req, res) => {
  const query = pick(req.query, [
    "date",
    "startDate",
    "endDate",
    "view",
    "userId",
  ]);

  const result = await InactiveUserReportService.getReport(query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Work activity report fetched successfully",
    meta: {
      ...result.meta,
      mode: result.mode,
      users: result.users || undefined,
    },
    data: result.data,
  });
});

const getUserDayActivity = catchAsync(async (req, res) => {
  const query = pick(req.query, ["userId", "date"]);

  const result = await InactiveUserReportService.getUserDayActivity(query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User activity log fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const InactiveUserReportController = {
  getReport,
  getUserDayActivity,
};

module.exports = InactiveUserReportController;

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { AttendanceSummaryFilterAbleFields } = require("./attendanceSummary.constants");
const AttendanceSummaryService = require("./attendanceSummary.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, AttendanceSummaryFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await AttendanceSummaryService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance summaries fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await AttendanceSummaryService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance summaries fetched successfully",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await AttendanceSummaryService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance summary fetched successfully",
    data: result,
  });
});

const getMyAttendanceSummary = catchAsync(async (req, res) => {
  const result = await AttendanceSummaryService.getMyAttendanceSummary(req.user.Id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee attendance summaries fetched successfully",
    data: result,
  });
});

module.exports = {
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  getMyAttendanceSummary,
};

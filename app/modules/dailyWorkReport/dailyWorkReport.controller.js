const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const {
  DailyWorkReportFilterableFields,
} = require("./dailyWorkReport.constants");
const DailyWorkReportService = require("./dailyWorkReport.service");

const submitReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.submitReport(req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report submitted successfully!!",
    data: result,
  });
});

const updateMyReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.updateMyReport(
    req.params.id,
    req.body,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report updated successfully!!",
    data: result,
  });
});

const deleteReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.deleteReport(
    req.params.id,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report deleted successfully!!",
    data: result,
  });
});

const getMyReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, DailyWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await DailyWorkReportService.getMyReports(
    req.user,
    filters,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "My daily work reports fetched successfully!!",
    meta: result.meta,
    data: result.data,
  });
});

const getAllReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, DailyWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await DailyWorkReportService.getAllReports(
    filters,
    options,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work reports fetched successfully!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.getDataById(
    req.params.id,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report fetched successfully!!",
    data: result,
  });
});

const reviewReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.reviewReport(
    req.params.id,
    req.body,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report reviewed successfully!!",
    data: result,
  });
});

const recalculatePerformanceScore = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.recalculatePerformanceScore(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance score calculated successfully!!",
    data: result,
  });
});

const getLeaderboard = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.getLeaderboard(
    req.query,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance leaderboard fetched successfully!!",
    data: result,
  });
});

const getEmployeeDashboard = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.getEmployeeDashboard(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee performance dashboard fetched successfully!!",
    data: result,
  });
});

const getAdminDashboard = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.getAdminDashboard(
    req.query,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin performance dashboard fetched successfully!!",
    data: result,
  });
});

const getEligibleSubmitters = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.getEligibleSubmitters(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report submitters fetched successfully!!",
    data: result,
  });
});

const getAssignedTasksForReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.getAssignedTasksForReport(
    req.query,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assigned tasks fetched successfully!!",
    data: result,
  });
});

const uploadProof = catchAsync(async (req, res) => {
  if (!req.file) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "Proof file is required",
      data: null,
    });
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Proof uploaded successfully!!",
    data: {
      fileName: req.file.filename,
      url: `/${process.env.APP_BASE_URL}/images/${req.file.filename}`,
    },
  });
});

const sendPendingReminders = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.sendPendingReminders(req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report reminders sent successfully!!",
    data: result,
  });
});

module.exports = {
  submitReport,
  updateMyReport,
  deleteReport,
  getMyReports,
  getAllReports,
  getDataById,
  reviewReport,
  recalculatePerformanceScore,
  getLeaderboard,
  getEmployeeDashboard,
  getAdminDashboard,
  getEligibleSubmitters,
  getAssignedTasksForReport,
  uploadProof,
  sendPendingReminders,
};

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const {
  LogisticWorkReportFilterableFields,
} = require("./logisticWorkReport.constants");
const LogisticWorkReportService = require("./logisticWorkReport.service");

const createReport = catchAsync(async (req, res) => {
  const result = await LogisticWorkReportService.createReport(req.body, req.user);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Logistic work report submitted successfully",
    data: result,
  });
});

const updateReport = catchAsync(async (req, res) => {
  const result = await LogisticWorkReportService.updateReport(
    req.params.id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logistic work report updated successfully",
    data: result,
  });
});

const deleteReport = catchAsync(async (req, res) => {
  const result = await LogisticWorkReportService.deleteReport(
    req.params.id,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logistic work report deleted successfully",
    data: result,
  });
});

const getMyReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, LogisticWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await LogisticWorkReportService.getMyReports(
    req.user,
    filters,
    options,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "My logistic work reports fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, LogisticWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await LogisticWorkReportService.getAllReports(
    filters,
    options,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logistic work reports fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await LogisticWorkReportService.getDataById(
    req.params.id,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logistic work report fetched successfully",
    data: result,
  });
});

module.exports = {
  createReport,
  updateReport,
  deleteReport,
  getMyReports,
  getAllReports,
  getDataById,
};

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const { ShifaReportFilterableFields } = require("./shifaReport.constants");
const ShifaReportService = require("./shifaReport.service");

const createReport = catchAsync(async (req, res) => {
  const result = await ShifaReportService.createReport(req.body, req.user);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Shifa report submitted successfully",
    data: result,
  });
});

const updateReport = catchAsync(async (req, res) => {
  const result = await ShifaReportService.updateReport(
    req.params.id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shifa report updated successfully",
    data: result,
  });
});

const deleteReport = catchAsync(async (req, res) => {
  const result = await ShifaReportService.deleteReport(req.params.id, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shifa report deleted successfully",
    data: result,
  });
});

const getMyReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, ShifaReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ShifaReportService.getMyReports(
    req.user,
    filters,
    options,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "My shifa reports fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, ShifaReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ShifaReportService.getAllReports(
    filters,
    options,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shifa reports fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ShifaReportService.getDataById(req.params.id, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Shifa report fetched successfully",
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

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const {
  EmployeeWorkReportFilterableFields,
} = require("./employeeWorkReport.constants");
const EmployeeWorkReportService = require("./employeeWorkReport.service");

const createReport = catchAsync(async (req, res) => {
  const result = await EmployeeWorkReportService.createReport(req.body, req.user);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Employee work report submitted successfully",
    data: result,
  });
});

const updateReport = catchAsync(async (req, res) => {
  const result = await EmployeeWorkReportService.updateReport(
    req.params.id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee work report updated successfully",
    data: result,
  });
});

const deleteReport = catchAsync(async (req, res) => {
  const result = await EmployeeWorkReportService.deleteReport(req.params.id, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee work report deleted successfully",
    data: result,
  });
});

const getMyReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, EmployeeWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await EmployeeWorkReportService.getMyReports(
    req.user,
    filters,
    options,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "My employee work reports fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, EmployeeWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await EmployeeWorkReportService.getAllReports(
    filters,
    options,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee work reports fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await EmployeeWorkReportService.getDataById(
    req.params.id,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee work report fetched successfully",
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

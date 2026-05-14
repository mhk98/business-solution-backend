const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { PayrollRunFilterAbleFields } = require("./payrollRun.constants");
const PayrollRunService = require("./payrollRun.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PayrollRunFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await PayrollRunService.listRuns(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Payroll runs fetched successfully", meta: result.meta, data: result.data });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PayrollRunService.getRunById(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Payroll run fetched successfully", data: result });
});

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await PayrollRunService.generatePayrollRun(req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Payroll generated successfully", data: result });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await PayrollRunService.updateRun(req.params.id, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Payroll run updated successfully", data: result });
});

module.exports = {
  getAllFromDB,
  getDataById,
  insertIntoDB,
  updateOneFromDB,
};

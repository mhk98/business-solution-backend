const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { PayrollItemFilterAbleFields } = require("./payrollItem.constants");
const PayrollItemService = require("./payrollItem.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PayrollItemFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await PayrollItemService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Payroll items fetched successfully", meta: result.meta, data: result.data });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PayrollItemService.getAllFromDBWithoutQuery();
  sendResponse(res, { statusCode: 200, success: true, message: "Payroll items fetched successfully", data: result });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PayrollItemService.getDataById(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Payroll item fetched successfully", data: result });
});

const getMyPayrollItems = catchAsync(async (req, res) => {
  const result = await PayrollItemService.getMyPayrollItems(req.user.Id);
  sendResponse(res, { statusCode: 200, success: true, message: "Employee payroll items fetched successfully", data: result });
});

module.exports = {
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  getMyPayrollItems,
};

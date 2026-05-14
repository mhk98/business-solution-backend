const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { LeaveTypeFilterAbleFields } = require("./leaveType.constants");
const LeaveTypeService = require("./leaveType.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await LeaveTypeService.insertIntoDB(req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave type created successfully", data: result });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, LeaveTypeFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await LeaveTypeService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave types fetched successfully", meta: result.meta, data: result.data });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await LeaveTypeService.getAllFromDBWithoutQuery();
  sendResponse(res, { statusCode: 200, success: true, message: "Leave types fetched successfully", data: result });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await LeaveTypeService.getDataById(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave type fetched successfully", data: result });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await LeaveTypeService.updateOneFromDB(req.params.id, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave type updated successfully", data: result });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await LeaveTypeService.deleteIdFromDB(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave type deleted successfully", data: result });
});

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
};

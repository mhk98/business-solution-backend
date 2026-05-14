const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { LeaveRequestFilterAbleFields } = require("./leaveRequest.constants");
const LeaveRequestService = require("./leaveRequest.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await LeaveRequestService.insertIntoDB(req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave request created successfully", data: result });
});
const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, LeaveRequestFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await LeaveRequestService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave requests fetched successfully", meta: result.meta, data: result.data });
});
const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await LeaveRequestService.getAllFromDBWithoutQuery();
  sendResponse(res, { statusCode: 200, success: true, message: "Leave requests fetched successfully", data: result });
});
const getDataById = catchAsync(async (req, res) => {
  const result = await LeaveRequestService.getDataById(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave request fetched successfully", data: result });
});
const getMyLeaveRequests = catchAsync(async (req, res) => {
  const result = await LeaveRequestService.getMyLeaveRequests(req.user.Id);
  sendResponse(res, { statusCode: 200, success: true, message: "Employee leave requests fetched successfully", data: result });
});
const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await LeaveRequestService.updateOneFromDB(req.params.id, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave request updated successfully", data: result });
});
const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await LeaveRequestService.deleteIdFromDB(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Leave request deleted successfully", data: result });
});

module.exports = { insertIntoDB, getAllFromDB, getAllFromDBWithoutQuery, getDataById, getMyLeaveRequests, updateOneFromDB, deleteIdFromDB };

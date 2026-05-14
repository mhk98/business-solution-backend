const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  AttendanceRegularizationFilterAbleFields,
} = require("./attendanceRegularization.constants");
const AttendanceRegularizationService = require("./attendanceRegularization.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await AttendanceRegularizationService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance regularization created successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, AttendanceRegularizationFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await AttendanceRegularizationService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance regularizations fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await AttendanceRegularizationService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance regularizations fetched successfully",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await AttendanceRegularizationService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance regularization fetched successfully",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await AttendanceRegularizationService.updateOneFromDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance regularization updated successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await AttendanceRegularizationService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance regularization deleted successfully",
    data: result,
  });
});

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
};

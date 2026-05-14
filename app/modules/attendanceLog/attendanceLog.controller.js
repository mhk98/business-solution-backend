const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const jwt = require("jsonwebtoken");
const { AttendanceLogFilterAbleFields } = require("./attendanceLog.constants");
const AttendanceLogService = require("./attendanceLog.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await AttendanceLogService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance log created successfully",
    data: result,
  });
});

const receiveRealtimeLog = catchAsync(async (req, res) => {
  let authenticatedUserId = null;
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    try {
      const verifiedUser = jwt.verify(token, process.env.TOKEN_SECRET);
      authenticatedUserId = verifiedUser?.Id || null;
    } catch (error) {
      authenticatedUserId = null;
    }
  }

  const result = await AttendanceLogService.receiveRealtimeLog(req.body, {
    authenticatedUserId,
    requestApiKey: req.headers["x-device-key"],
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.duplicate
      ? "Duplicate realtime attendance log ignored"
      : "Realtime attendance log received successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, AttendanceLogFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await AttendanceLogService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance logs fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getRealtimeMonitor = catchAsync(async (req, res) => {
  const result = await AttendanceLogService.getRealtimeMonitor(
    req.query.date || req.body.date,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Realtime attendance monitor fetched successfully",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await AttendanceLogService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance logs fetched successfully",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await AttendanceLogService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance log fetched successfully",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await AttendanceLogService.updateOneFromDB(req.params.id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance log updated successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await AttendanceLogService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance log deleted successfully",
    data: result,
  });
});

const processDailyAttendance = catchAsync(async (req, res) => {
  const result = await AttendanceLogService.processDailyAttendance(
    req.body.date || req.query.date,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance processed successfully",
    data: result,
  });
});

module.exports = {
  insertIntoDB,
  receiveRealtimeLog,
  getRealtimeMonitor,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  processDailyAttendance,
};

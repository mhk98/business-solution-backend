const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  AttendanceDeviceFilterAbleFields,
} = require("./attendanceDevice.constants");
const AttendanceDeviceService = require("./attendanceDevice.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await AttendanceDeviceService.insertIntoDB(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Attendance device submitted for approval"
        : "Attendance device created successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, AttendanceDeviceFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await AttendanceDeviceService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance devices fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await AttendanceDeviceService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance devices fetched successfully",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await AttendanceDeviceService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance device fetched successfully",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await AttendanceDeviceService.updateOneFromDB(
    req.params.id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Attendance device update submitted for approval"
        : "Attendance device updated successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await AttendanceDeviceService.deleteIdFromDB(
    req.params.id,
    req.user,
    req.body?.note,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "delete_requested"
        ? "Attendance device delete request submitted for approval"
        : "Attendance device deleted successfully",
    data: result,
  });
});

const approveOneFromDB = catchAsync(async (req, res) => {
  const result = await AttendanceDeviceService.approveOneFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "deleted"
        ? "Pending delete request completed successfully"
        : "Attendance device approved successfully",
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
  approveOneFromDB,
};

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { HolidayFilterAbleFields } = require("./holiday.constants");
const HolidayService = require("./holiday.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await HolidayService.insertIntoDB(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Holiday submitted for approval"
        : "Holiday created successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, HolidayFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await HolidayService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Holidays fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await HolidayService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Holidays fetched successfully",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await HolidayService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Holiday fetched successfully",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await HolidayService.updateOneFromDB(
    req.params.id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Holiday update submitted for approval"
        : "Holiday updated successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await HolidayService.deleteIdFromDB(
    req.params.id,
    req.user,
    req.body?.note,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "delete_requested"
        ? "Holiday delete request submitted for approval"
        : "Holiday deleted successfully",
    data: result,
  });
});

const approveOneFromDB = catchAsync(async (req, res) => {
  const result = await HolidayService.approveOneFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "deleted"
        ? "Pending delete request completed successfully"
        : "Holiday approved successfully",
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

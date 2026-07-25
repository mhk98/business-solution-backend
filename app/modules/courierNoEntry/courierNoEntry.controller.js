const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const CourierNoEntryService = require("./courierNoEntry.service");
const {
  CourierNoEntryFilterAbleFileds,
} = require("./courierNoEntry.constants");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await CourierNoEntryService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Courier No Entry created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, CourierNoEntryFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await CourierNoEntryService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Courier No Entry data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await CourierNoEntryService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Courier No Entry data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await CourierNoEntryService.updateOneFromDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Courier No Entry updated successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await CourierNoEntryService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Courier No Entry deleted successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await CourierNoEntryService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Courier No Entry data fetch!!",
    data: result,
  });
});

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

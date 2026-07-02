const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { OwnerFilterAbleFields } = require("./owner.constants");
const OwnerService = require("./owner.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await OwnerService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, OwnerFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await OwnerService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await OwnerService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await OwnerService.updateOneFromDB(req.params.id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await OwnerService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await OwnerService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner data fetch!!",
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

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  OwnerTransactionFilterAbleFields,
} = require("./ownerTransaction.constants");
const OwnerTransactionService = require("./ownerTransaction.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await OwnerTransactionService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner transaction created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, OwnerTransactionFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await OwnerTransactionService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner transaction data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await OwnerTransactionService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner transaction data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await OwnerTransactionService.updateOneFromDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner transaction update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await OwnerTransactionService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner transaction delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await OwnerTransactionService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Owner transaction data fetch!!",
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

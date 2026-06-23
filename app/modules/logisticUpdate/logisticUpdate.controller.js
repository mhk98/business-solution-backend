const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const { LogisticUpdateFilterableFields } = require("./logisticUpdate.constants");
const LogisticUpdateService = require("./logisticUpdate.service");

const createUpdate = catchAsync(async (req, res) => {
  const result = await LogisticUpdateService.createUpdate(req.body, req.user);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Logistic update added successfully",
    data: result,
  });
});

const updateOne = catchAsync(async (req, res) => {
  const result = await LogisticUpdateService.updateOne(req.params.id, req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logistic update edited successfully",
    data: result,
  });
});

const getAll = catchAsync(async (req, res) => {
  const filters = pick(req.query, LogisticUpdateFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await LogisticUpdateService.getAll(filters, options, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logistic updates fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await LogisticUpdateService.getDataById(req.params.id, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logistic update fetched successfully",
    data: result,
  });
});

const getDepartments = catchAsync(async (req, res) => {
  const result = await LogisticUpdateService.getDepartments();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Departments fetched successfully",
    data: result,
  });
});

module.exports = { createUpdate, updateOne, getAll, getDataById, getDepartments };

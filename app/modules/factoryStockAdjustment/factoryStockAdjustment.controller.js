const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  FactoryStockAdjustmentFilterAbleFileds,
} = require("./factoryStockAdjustment.constants");
const FactoryStockAdjustmentService = require("./factoryStockAdjustment.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await FactoryStockAdjustmentService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FactoryStockAdjustment data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, FactoryStockAdjustmentFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await FactoryStockAdjustmentService.getAllFromDB(
    filters,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Factory stock adjustment data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await FactoryStockAdjustmentService.getDataById(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FactoryStockAdjustment data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await FactoryStockAdjustmentService.updateOneFromDB(
    id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FactoryStockAdjustment update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await FactoryStockAdjustmentService.deleteIdFromDB(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FactoryStockAdjustment delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await FactoryStockAdjustmentService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "FactoryStockAdjustment data fetch!!",
    data: result,
  });
});

const FactoryStockAdjustmentController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = FactoryStockAdjustmentController;

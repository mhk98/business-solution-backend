const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  PackagingItemStockAdjustmentFilterAbleFileds,
} = require("./packagingItemStockAdjustment.constants");
const PackagingItemStockAdjustmentService = require("./packagingItemStockAdjustment.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await PackagingItemStockAdjustmentService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingItemStockAdjustment data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PackagingItemStockAdjustmentFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await PackagingItemStockAdjustmentService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Packaging item stock adjustment data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PackagingItemStockAdjustmentService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingItemStockAdjustment data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await PackagingItemStockAdjustmentService.updateOneFromDB(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingItemStockAdjustment update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PackagingItemStockAdjustmentService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingItemStockAdjustment delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PackagingItemStockAdjustmentService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingItemStockAdjustment data fetch!!",
    data: result,
  });
});

const PackagingItemStockAdjustmentController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = PackagingItemStockAdjustmentController;

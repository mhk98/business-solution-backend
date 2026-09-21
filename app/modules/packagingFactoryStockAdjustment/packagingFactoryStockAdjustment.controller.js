const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  PackagingFactoryStockAdjustmentFilterAbleFileds,
} = require("./packagingFactoryStockAdjustment.constants");
const PackagingFactoryStockAdjustmentService = require("./packagingFactoryStockAdjustment.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await PackagingFactoryStockAdjustmentService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingFactoryStockAdjustment data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PackagingFactoryStockAdjustmentFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await PackagingFactoryStockAdjustmentService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Packaging factory stock adjustment data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PackagingFactoryStockAdjustmentService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingFactoryStockAdjustment data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await PackagingFactoryStockAdjustmentService.updateOneFromDB(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingFactoryStockAdjustment update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PackagingFactoryStockAdjustmentService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingFactoryStockAdjustment delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PackagingFactoryStockAdjustmentService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PackagingFactoryStockAdjustment data fetch!!",
    data: result,
  });
});

const PackagingFactoryStockAdjustmentController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = PackagingFactoryStockAdjustmentController;

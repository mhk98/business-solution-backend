const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  PackagingItemStockFilterAbleFileds,
} = require("./packagingItemStock.constants");
const PackagingItemStockService = require("./packagingItemStock.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PackagingItemStockFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await PackagingItemStockService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Packaging item stock data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PackagingItemStockService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Packaging item stock data fetched!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PackagingItemStockService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Packaging item stock data fetch!!",
    data: result,
  });
});

module.exports = {
  getAllFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

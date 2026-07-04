const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  ManufactureStockFilterAbleFileds,
} = require("./manufactureStock.constants");
const ManufactureStockService = require("./manufactureStock.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ManufactureStockFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await ManufactureStockService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacture stock data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ManufactureStockService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacture stock data fetched!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await ManufactureStockService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacture stock data fetch!!",
    data: result,
  });
});

const ManufactureStockController = {
  getAllFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ManufactureStockController;

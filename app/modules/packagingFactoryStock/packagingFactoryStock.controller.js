const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  PackagingFactoryStockFilterAbleFileds,
} = require("./packagingFactoryStock.constants");
const PackagingFactoryStockService = require("./packagingFactoryStock.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PackagingFactoryStockFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await PackagingFactoryStockService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging factory stock fetched!!", meta: result.meta, data: result.data });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PackagingFactoryStockService.getAllFromDBWithoutQuery();
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging factory stock fetch!!", data: result });
});

module.exports = { getAllFromDB, getAllFromDBWithoutQuery };

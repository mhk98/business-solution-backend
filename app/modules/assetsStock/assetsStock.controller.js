const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const AssetsStockService = require("./assetsStock.service");

const filterFields = ["name", "startDate", "endDate"];

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, filterFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await AssetsStockService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assets stock fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await AssetsStockService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assets stock fetched successfully",
    data: result,
  });
});

module.exports = {
  getAllFromDB,
  getAllFromDBWithoutQuery,
};

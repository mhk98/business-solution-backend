const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  StockMovementFilterableFields,
} = require("./stockMovement.constants");
const StockMovementService = require("./stockMovement.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, StockMovementFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await StockMovementService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Stock movement data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await StockMovementService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Stock movement data fetched!!",
    data: result,
  });
});

module.exports = {
  getAllFromDB,
  getDataById,
};

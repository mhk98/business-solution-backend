const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const ConfirmOrderService = require("./confirmOrder.service");

const getTrendingProducts = catchAsync(async (req, res) => {
  const filters = req.query;

  const result = await ConfirmOrderService.getTrendingProductsFromDB(filters);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Confirm order data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const ConfirmOrderController = {
  getTrendingProducts,
};

module.exports = ConfirmOrderController;

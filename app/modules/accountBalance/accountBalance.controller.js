const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const AccountBalanceService = require("./accountBalance.service");

const getSummary = catchAsync(async (req, res) => {
  const result = await AccountBalanceService.getSummary();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Account balance summary fetched!!",
    data: result,
  });
});

module.exports = { getSummary };

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const SystemResetService = require("./systemReset.service");

const resetData = catchAsync(async (req, res) => {
  const result = await SystemResetService.resetData({
    mode: req.body?.mode,
    confirmation: req.body?.confirmation,
    user: req.user,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Data hard deleted successfully",
    data: result,
  });
});

module.exports = {
  resetData,
};

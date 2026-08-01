const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const ApiGatewaySettingService = require("./apiGatewaySetting.service");

const getGatewaySettings = catchAsync(async (req, res) => {
  const result = await ApiGatewaySettingService.getGatewaySettings();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "API gateway settings fetched successfully",
    data: result,
  });
});

const getGatewaySetting = catchAsync(async (req, res) => {
  const result = await ApiGatewaySettingService.getGatewaySetting(
    req.params.gatewayType,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "API gateway setting fetched successfully",
    data: result,
  });
});

const upsertGatewaySetting = catchAsync(async (req, res) => {
  const result = await ApiGatewaySettingService.upsertGatewaySetting(
    req.params.gatewayType,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "API gateway setting saved successfully",
    data: result,
  });
});

module.exports = {
  getGatewaySettings,
  getGatewaySetting,
  upsertGatewaySetting,
};

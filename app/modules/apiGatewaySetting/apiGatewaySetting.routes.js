const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const ApiGatewaySettingController = require("./apiGatewaySetting.controller");

const apiGatewayPermission = requireMenuPermission("api_gateway");

router.get(
  "/",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  apiGatewayPermission,
  ApiGatewaySettingController.getGatewaySettings,
);

router.get(
  "/:gatewayType",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  apiGatewayPermission,
  ApiGatewaySettingController.getGatewaySetting,
);

router.put(
  "/:gatewayType",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  apiGatewayPermission,
  ApiGatewaySettingController.upsertGatewaySetting,
);

module.exports = router;

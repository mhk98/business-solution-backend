const router = require("express").Router();
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const ChargeSettingController = require("./chargeSetting.controller");

// Access follows Role Permissions (not a fixed role list), per charge type:
// COD Charge permission opens only COD Charge, etc. — so e.g. an accountant
// given COD Charge / Delivery Charge in Role Permissions can use exactly
// those two. superAdmin always passes (effective permissions "*").
const CHARGE_TYPE_PERMISSIONS = {
  cod: "cod_charge",
  codchange: "cod_change",
  delivery: "delivery_charge",
  deliveryadvance: "delivery_advance",
  shippingcharge: "shipping_charge",
};

const chargeSettingPermission = (req, res, next) => {
  const chargeType = String(req.query?.chargeType || req.body?.chargeType || "")
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, "");
  const permission = CHARGE_TYPE_PERMISSIONS[chargeType];
  // Unknown/missing type: the service rejects it with "Invalid charge type".
  if (!permission) {
    return requireAnyPermission(Object.values(CHARGE_TYPE_PERMISSIONS))(req, res, next);
  }
  return requireMenuPermission(permission)(req, res, next);
};

router.get(
  "/",
  auth(),
  chargeSettingPermission,
  ChargeSettingController.getChargeSettings,
);
router.post(
  "/create",
  auth(),
  chargeSettingPermission,
  ChargeSettingController.createChargeSetting,
);
router.put(
  "/:id",
  auth(),
  chargeSettingPermission,
  ChargeSettingController.updateChargeSetting,
);
router.delete(
  "/:id",
  auth(),
  chargeSettingPermission,
  ChargeSettingController.deleteChargeSetting,
);

module.exports = router;

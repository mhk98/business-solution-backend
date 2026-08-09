const router = require("express").Router();
const auth = require("../../middlewares/auth");
const { requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const ShifaIncentiveController = require("./shifaIncentive.controller");

const incentivePermissions = [
  "shifa",
  "shifa_incentive",
  "employee_profile",
  "employee_list",
  "employee_management",
];

router.post(
  "/create",
  auth(),
  requireAnyPermission(incentivePermissions),
  ShifaIncentiveController.createIncentive,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(incentivePermissions),
  ShifaIncentiveController.getAllIncentives,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(incentivePermissions),
  ShifaIncentiveController.getDataById,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(incentivePermissions),
  ShifaIncentiveController.updateIncentive,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(incentivePermissions),
  ShifaIncentiveController.deleteIncentive,
);

module.exports = router;

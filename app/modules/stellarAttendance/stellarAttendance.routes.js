const router = require("express").Router();
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const StellarAttendanceController = require("./stellarAttendance.controller");

router.get(
  "/logs",
  auth(),
  requireMenuPermission("attendance"),
  StellarAttendanceController.getLogs,
);

router.get(
  "/users",
  auth(),
  requireMenuPermission("attendance"),
  StellarAttendanceController.getUsers,
);

module.exports = router;

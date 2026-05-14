const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const AttendanceRegularizationController = require("./attendanceRegularization.controller");

router.post(
  "/create",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceRegularizationController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceRegularizationController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceRegularizationController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceRegularizationController.getDataById,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceRegularizationController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("attendance"),
  AttendanceRegularizationController.deleteIdFromDB,
);

module.exports = router;

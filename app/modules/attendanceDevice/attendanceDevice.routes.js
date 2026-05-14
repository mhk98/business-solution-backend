const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const AttendanceDeviceController = require("./attendanceDevice.controller");

router.post(
  "/create",
  auth(),
  requireMenuPermission("attendance_device"),
  AttendanceDeviceController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("attendance_device"),
  AttendanceDeviceController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("attendance_device"),
  AttendanceDeviceController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("attendance_device"),
  AttendanceDeviceController.getDataById,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("attendance_device"),
  AttendanceDeviceController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("attendance_device"),
  AttendanceDeviceController.deleteIdFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("attendance_device"),
  AttendanceDeviceController.approveOneFromDB,
);

module.exports = router;

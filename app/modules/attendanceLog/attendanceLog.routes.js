const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const AttendanceLogController = require("./attendanceLog.controller");

router.post(
  "/realtime-ingest",
  AttendanceLogController.receiveRealtimeLog,
);
router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireMenuPermission("attendance"),
  AttendanceLogController.insertIntoDB,
);
router.post(
  "/process-daily",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireMenuPermission("attendance"),
  AttendanceLogController.processDailyAttendance,
);
router.get(
  "/monitor",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceLogController.getRealtimeMonitor,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceLogController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceLogController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceLogController.getDataById,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireMenuPermission("attendance"),
  AttendanceLogController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("attendance"),
  AttendanceLogController.deleteIdFromDB,
);

module.exports = router;

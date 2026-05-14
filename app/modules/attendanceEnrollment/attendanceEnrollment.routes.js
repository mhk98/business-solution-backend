const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const AttendanceEnrollmentController = require("./attendanceEnrollment.controller");

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireMenuPermission("attendance"),
  AttendanceEnrollmentController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceEnrollmentController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceEnrollmentController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("attendance"),
  AttendanceEnrollmentController.getDataById,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireMenuPermission("attendance"),
  AttendanceEnrollmentController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("attendance"),
  AttendanceEnrollmentController.deleteIdFromDB,
);

module.exports = router;

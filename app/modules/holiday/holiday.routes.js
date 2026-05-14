const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const HolidayController = require("./holiday.controller");

router.post(
  "/create",
  auth(),
  requireMenuPermission("holiday_management"),
  HolidayController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("holiday_management"),
  HolidayController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("holiday_management"),
  HolidayController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("holiday_management"),
  HolidayController.getDataById,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("holiday_management"),
  HolidayController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("holiday_management"),
  HolidayController.deleteIdFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("holiday_management"),
  HolidayController.approveOneFromDB,
);

module.exports = router;

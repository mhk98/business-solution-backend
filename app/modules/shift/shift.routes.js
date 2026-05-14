const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const ShiftController = require("./shift.controller");

router.post(
  "/create",
  auth(),
  requireMenuPermission("shift_management"),
  ShiftController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("shift_management"),
  ShiftController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("shift_management"),
  ShiftController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("shift_management"),
  ShiftController.getDataById,
);
router.put(
  "/:id",
  auth(),
  requireMenuPermission("shift_management"),
  ShiftController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("shift_management"),
  ShiftController.deleteIdFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("shift_management"),
  ShiftController.approveOneFromDB,
);

module.exports = router;

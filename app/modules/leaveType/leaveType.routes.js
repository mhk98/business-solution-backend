const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission, requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const LeaveTypeController = require("./leaveType.controller");

router.post("/create", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.HR), requireMenuPermission("leave_type"), LeaveTypeController.insertIntoDB);
router.get("/", auth(), requireAnyPermission(["leave_type", "leave_management"]), LeaveTypeController.getAllFromDB);
router.get("/all", auth(), requireAnyPermission(["leave_type", "leave_management"]), LeaveTypeController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), requireAnyPermission(["leave_type", "leave_management"]), LeaveTypeController.getDataById);
router.put("/:id", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.HR), requireMenuPermission("leave_type"), LeaveTypeController.updateOneFromDB);
router.delete("/:id", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), requireMenuPermission("leave_type"), LeaveTypeController.deleteIdFromDB);

module.exports = router;

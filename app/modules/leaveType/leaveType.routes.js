const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const LeaveTypeController = require("./leaveType.controller");

router.post("/create", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT), requireMenuPermission("leave_management"), LeaveTypeController.insertIntoDB);
router.get("/", auth(), requireMenuPermission("leave_management"), LeaveTypeController.getAllFromDB);
router.get("/all", auth(), requireMenuPermission("leave_management"), LeaveTypeController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), requireMenuPermission("leave_management"), LeaveTypeController.getDataById);
router.put("/:id", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT), requireMenuPermission("leave_management"), LeaveTypeController.updateOneFromDB);
router.delete("/:id", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), requireMenuPermission("leave_management"), LeaveTypeController.deleteIdFromDB);

module.exports = router;

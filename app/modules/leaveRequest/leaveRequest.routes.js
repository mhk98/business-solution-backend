const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const LeaveRequestController = require("./leaveRequest.controller");

router.post("/create", auth(), requireMenuPermission("leave_management"), LeaveRequestController.insertIntoDB);
router.get("/", auth(), requireMenuPermission("leave_management"), LeaveRequestController.getAllFromDB);
router.get("/all", auth(), requireMenuPermission("leave_management"), LeaveRequestController.getAllFromDBWithoutQuery);
router.get("/me", auth(), requireAnyPermission(["employee_profile", "leave_management"]), LeaveRequestController.getMyLeaveRequests);
router.get("/:id", auth(), requireMenuPermission("leave_management"), LeaveRequestController.getDataById);
router.put("/:id", auth(), requireMenuPermission("leave_management"), LeaveRequestController.updateOneFromDB);
router.delete("/:id", auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), requireMenuPermission("leave_management"), LeaveRequestController.deleteIdFromDB);

module.exports = router;

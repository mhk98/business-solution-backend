const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const EmployeeListController = require("./employeeList.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.getAllFromDBWithoutQuery,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission([
    "employee_profile",
    "employee_management",
    "employee_list",
  ]),
  EmployeeListController.getMyProfile,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.getDataById,
);
router.delete(
  "/:id",
  auth(),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.approveOneFromDB,
);

const EmployeeListRoutes = router;
module.exports = EmployeeListRoutes;

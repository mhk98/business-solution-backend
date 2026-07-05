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
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.insertIntoDB,
);
router.get(
  "/",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.getAllFromDB,
);
router.get(
  "/all",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.getAllFromDBWithoutQuery,
);
router.get(
  "/me",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission([
    "employee_profile",
    "employee_management",
    "employee_list",
  ]),
  EmployeeListController.getMyProfile,
);
router.get(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.getDataById,
);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireAnyPermission(["employee_management", "employee_list"]),
  EmployeeListController.approveOneFromDB,
);

const EmployeeListRoutes = router;
module.exports = EmployeeListRoutes;

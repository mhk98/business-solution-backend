const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const DepartmentController = require("./department.controller");

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireMenuPermission("department_designation"),
  DepartmentController.insertIntoDB,
);
router.get(
  "/",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireMenuPermission("department_designation"),
  DepartmentController.getAllFromDB,
);
router.get(
  "/all",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireMenuPermission("department_designation"),
  DepartmentController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireMenuPermission("department_designation"),
  DepartmentController.getDataById,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireMenuPermission("department_designation"),
  DepartmentController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireMenuPermission("department_designation"),
  DepartmentController.deleteIdFromDB,
);
router.post(
  "/:id/approve",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
    ENUM_USER_ROLE.HR,
  ),
  requireMenuPermission("department_designation"),
  DepartmentController.approveOneFromDB,
);

module.exports = router;

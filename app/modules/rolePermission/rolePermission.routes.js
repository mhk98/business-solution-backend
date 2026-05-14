const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const requireRoles = require("../../middlewares/requireRoles");
const RolePermissionController = require("./rolePermission.controller");

router.get(
  "/",
  auth(),
  requireRoles(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  RolePermissionController.getAllRolePermissions,
);

router.get(
  "/:role",
  auth(),
  requireRoles(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  RolePermissionController.getRolePermissionByRole,
);

router.put(
  "/:role",
  auth(),
  requireRoles(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  RolePermissionController.updateRolePermissions,
);

module.exports = router;

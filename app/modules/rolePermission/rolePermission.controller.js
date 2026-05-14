const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const RolePermissionService = require("./rolePermission.service");

const getAllRolePermissions = catchAsync(async (req, res) => {
  const result = await RolePermissionService.getAllRolePermissions();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Role permissions fetched successfully",
    data: result,
  });
});

const getRolePermissionByRole = catchAsync(async (req, res) => {
  const result = await RolePermissionService.getRolePermissionByRole(
    req.params.role,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Role permission fetched successfully",
    data: result,
  });
});

const updateRolePermissions = catchAsync(async (req, res) => {
  const result = await RolePermissionService.updateRolePermissions(
    req.params.role,
    req.body.menuPermissions,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Role permissions updated successfully",
    data: result,
  });
});

module.exports = {
  getAllRolePermissions,
  getRolePermissionByRole,
  updateRolePermissions,
};

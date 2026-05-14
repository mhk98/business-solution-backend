const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const {
  DEFAULT_ROLE_MENU_PERMISSIONS,
} = require("../../config/roleMenuPermissions");
const { ALL_MENU_PERMISSIONS } = require("../../enums/menuPermissions");
const { ENUM_USER_ROLE } = require("../../enums/user");

const RolePermission = db.rolePermission;

const validRoles = Object.values(ENUM_USER_ROLE);
const validMenuPermissionSet = new Set(ALL_MENU_PERMISSIONS);

const uniq = (items = []) => [...new Set(items)];

const isValidRole = (role) => validRoles.includes(role);

// Legacy permission keys used by older UI versions.
// Backend routes currently guard with "department_designation", so we treat these as equivalent.
const LEGACY_PERMISSION_ALIASES = {
  department_management: "department_designation",
  designation_management: "department_designation",
};

const expandLegacyPermissions = (permissions = []) => {
  const expanded = new Set(permissions);
  permissions.forEach((key) => {
    const mapped = LEGACY_PERMISSION_ALIASES[key];
    if (mapped) expanded.add(mapped);
  });
  return Array.from(expanded);
};

const sanitizePermission = (permission) => {
  if (typeof permission !== "string") {
    return permission;
  }

  return permission.trim().toLowerCase();
};

const normalizeMenuPermissions = (menuPermissions) => {
  if (Array.isArray(menuPermissions)) {
    if (
      menuPermissions.length === 1 &&
      typeof menuPermissions[0] === "string"
    ) {
      const onlyValue = menuPermissions[0].trim();
      if (onlyValue.startsWith("[") || onlyValue.startsWith("{")) {
        return normalizeMenuPermissions(onlyValue);
      }
    }

    return menuPermissions;
  }

  if (menuPermissions == null || menuPermissions === "") {
    return [];
  }

  if (typeof menuPermissions === "string") {
    try {
      const parsed = JSON.parse(menuPermissions);
      return normalizeMenuPermissions(parsed);
    } catch (error) {
      return [];
    }
  }

  if (typeof menuPermissions === "object") {
    return normalizeMenuPermissions(menuPermissions.menuPermissions);
  }

  return [];
};

const validateRole = (role) => {
  if (!isValidRole(role)) {
    throw new ApiError(400, "Invalid role");
  }
};

const validateMenuPermissions = (menuPermissions) => {
  const normalizedPermissions = expandLegacyPermissions(
    normalizeMenuPermissions(menuPermissions).map(sanitizePermission),
  );

  if (!Array.isArray(normalizedPermissions)) {
    throw new ApiError(400, "menuPermissions must be an array");
  }

  const invalidPermissions = uniq(normalizedPermissions).filter(
    (permission) => !validMenuPermissionSet.has(permission),
  );

  if (invalidPermissions.length) {
    throw new ApiError(
      400,
      `Unknown menu permission(s): ${invalidPermissions.join(", ")}`,
    );
  }

  return uniq(normalizedPermissions);
};

const includeNewSettingsChildren = (role, permissions = []) => {
  const permissionSet = new Set(normalizeMenuPermissions(permissions));
  const defaults = DEFAULT_ROLE_MENU_PERMISSIONS[role] || [];

  if (
    permissionSet.has("settings") &&
    defaults.includes("notice") &&
    !permissionSet.has("notice")
  ) {
    permissionSet.add("notice");
  }

  if (defaults.includes("tasks") && !permissionSet.has("tasks")) {
    permissionSet.add("tasks");
  }

  if (defaults.includes("loan") && !permissionSet.has("loan")) {
    permissionSet.add("loan");
  }

  [
    "ads_campaign_kpi",
    "auto_profit_loss",
    "stock_alert",
    "daily_work_reports",
    "cs_work_reports",
    "logistic_work_reports",
    "employee_profile",
    "employee_kpi",
  ].forEach((permission) => {
    if (defaults.includes(permission) && !permissionSet.has(permission)) {
      permissionSet.add(permission);
    }
  });

  return Array.from(permissionSet);
};

const getDefaultPermissionsForRole = (role) => {
  validateRole(role);
  return uniq(DEFAULT_ROLE_MENU_PERMISSIONS[role] || []);
};

const getEffectiveMenuPermissions = async (role) => {
  validateRole(role);

  const record = await RolePermission.findOne({
    where: { role },
  });

  if (!record) {
    // Fallback to configured defaults when no explicit role-permission record exists.
    // This keeps the UI navigable out of the box and prevents empty permission sets.
    return validateMenuPermissions(getDefaultPermissionsForRole(role));
  }

  return validateMenuPermissions(
    includeNewSettingsChildren(role, record.menuPermissions || []),
  );
};

const getAllRolePermissions = async () => {
  const records = await Promise.all(
    validRoles.map(async (role) => ({
      role,
      menuPermissions: await getEffectiveMenuPermissions(role),
    })),
  );

  return records;
};

const getRolePermissionByRole = async (role) => {
  return {
    role,
    menuPermissions: await getEffectiveMenuPermissions(role),
  };
};

const updateRolePermissions = async (role, menuPermissions) => {
  validateRole(role);
  const normalizedPermissions = validateMenuPermissions(menuPermissions);

  await RolePermission.upsert({
    role,
    menuPermissions: normalizedPermissions,
  });

  return getRolePermissionByRole(role);
};

const hasMenuPermission = (userPermissions = [], requiredPermission) => {
  const alias = LEGACY_PERMISSION_ALIASES[requiredPermission];
  return (
    userPermissions.includes(requiredPermission) ||
    (alias ? userPermissions.includes(alias) : false) ||
    // Also allow legacy keys to satisfy the canonical permission check.
    (requiredPermission === "department_designation" &&
      (userPermissions.includes("department_management") ||
        userPermissions.includes("designation_management"))) ||
    userPermissions.includes("*") ||
    requiredPermission === "*"
  );
};

module.exports = {
  getAllRolePermissions,
  getRolePermissionByRole,
  updateRolePermissions,
  getEffectiveMenuPermissions,
  getDefaultPermissionsForRole,
  validateMenuPermissions,
  validateRole,
  isValidRole,
  hasMenuPermission,
  validRoles,
};

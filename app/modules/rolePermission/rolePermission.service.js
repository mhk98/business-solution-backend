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
const EMAIL_NOTIFICATION_PERMISSION_PREFIX = "email_notify:";
const SMS_NOTIFICATION_PERMISSION_PREFIX = "sms_notify:";
const LEGACY_MOBILE_NOTIFICATION_PERMISSION_PREFIX = "mobile_notify:";
const roleAliases = validRoles.reduce((acc, role) => {
  acc[String(role).toLowerCase()] = role;
  return acc;
}, {});

const uniq = (items = []) => [...new Set(items)];

const normalizeRole = (role, fallbackRole = null) => {
  if (role == null || role === "") return fallbackRole;
  return roleAliases[String(role).trim().toLowerCase()] || role;
};

const isValidRole = (role) => validRoles.includes(normalizeRole(role));

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

  const normalizedPermission = permission.trim().toLowerCase();
  if (
    normalizedPermission.startsWith(LEGACY_MOBILE_NOTIFICATION_PERMISSION_PREFIX)
  ) {
    return `${SMS_NOTIFICATION_PERMISSION_PREFIX}${normalizedPermission.slice(
      LEGACY_MOBILE_NOTIFICATION_PERMISSION_PREFIX.length,
    )}`;
  }

  return normalizedPermission;
};

const isValidMenuPermission = (permission) => {
  if (validMenuPermissionSet.has(permission)) return true;

  if (String(permission || "").startsWith(EMAIL_NOTIFICATION_PERMISSION_PREFIX)) {
    const menuPermission = permission.slice(
      EMAIL_NOTIFICATION_PERMISSION_PREFIX.length,
    );
    return validMenuPermissionSet.has(menuPermission);
  }

  if (
    String(permission || "").startsWith(SMS_NOTIFICATION_PERMISSION_PREFIX)
  ) {
    const menuPermission = permission.slice(
      SMS_NOTIFICATION_PERMISSION_PREFIX.length,
    );
    return validMenuPermissionSet.has(menuPermission);
  }

  if (
    String(permission || "").startsWith(
      LEGACY_MOBILE_NOTIFICATION_PERMISSION_PREFIX,
    )
  ) {
    const menuPermission = permission.slice(
      LEGACY_MOBILE_NOTIFICATION_PERMISSION_PREFIX.length,
    );
    return validMenuPermissionSet.has(menuPermission);
  }

  return false;
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
  const normalizedRole = normalizeRole(role);
  if (!validRoles.includes(normalizedRole)) {
    throw new ApiError(400, "Invalid role");
  }
  return normalizedRole;
};

const validateMenuPermissions = (menuPermissions) => {
  const normalizedPermissions = expandLegacyPermissions(
    normalizeMenuPermissions(menuPermissions).map(sanitizePermission),
  );

  if (!Array.isArray(normalizedPermissions)) {
    throw new ApiError(400, "menuPermissions must be an array");
  }

  const invalidPermissions = uniq(normalizedPermissions).filter(
    (permission) => !isValidMenuPermission(permission),
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

  if (defaults.includes("owner") && !permissionSet.has("owner")) {
    permissionSet.add("owner");
  }

  if (
    defaults.includes("owner_transaction") &&
    !permissionSet.has("owner_transaction")
  ) {
    permissionSet.add("owner_transaction");
  }

  [
    "cod_change",
    "cod_charge",
    "delivery_advance",
    "delivery_charge",
    "api_gateway",
    "sms_gateway",
    "email_notification_gateway",
    "role_permissions",
    "email_notification_permissions",
    "sms_notification_permissions",
    "master_permission",
    "ads_campaign_kpi",
    "auto_profit_loss",
    "packaging",
    "packaging_item",
    "packaging_item_stock",
    "packaging_item_purchase",
    "packaging_manufacturer",
    "packaging_factory",
    "packaging_factory_stock",
    "packaging_mixer",
    "stock_alert",
    "stock_movement",
    "cs_work_reports",
    "logistic_work_reports",
    "employee_profile",
    "employee_kpi",
  ].forEach((permission) => {
    if (defaults.includes(permission) && !permissionSet.has(permission)) {
      permissionSet.add(permission);
    }
  });

  if (permissionSet.has("logistic_work_reports")) {
    permissionSet.add("logistic_update");
  }

  return Array.from(permissionSet);
};

const getDefaultPermissionsForRole = (role) => {
  const normalizedRole = validateRole(role);
  const permissions = new Set(DEFAULT_ROLE_MENU_PERMISSIONS[normalizedRole] || []);
  if (permissions.has("logistic_work_reports")) {
    permissions.add("logistic_update");
  }
  return Array.from(permissions);
};

const getEffectiveMenuPermissions = async (role) => {
  const normalizedRole = validateRole(
    normalizeRole(role, ENUM_USER_ROLE.USER),
  );

  const record = await RolePermission.findOne({
    where: { role: normalizedRole },
  });

  if (!record) {
    // Fallback to configured defaults when no explicit role-permission record exists.
    // This keeps the UI navigable out of the box and prevents empty permission sets.
    return validateMenuPermissions(getDefaultPermissionsForRole(normalizedRole));
  }

  return validateMenuPermissions(
    includeNewSettingsChildren(normalizedRole, record.menuPermissions || []),
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
  const normalizedRole = validateRole(role);
  return {
    role: normalizedRole,
    menuPermissions: await getEffectiveMenuPermissions(normalizedRole),
  };
};

const updateRolePermissions = async (role, menuPermissions) => {
  const normalizedRole = validateRole(role);
  const normalizedPermissions = validateMenuPermissions(menuPermissions);

  await RolePermission.upsert({
    role: normalizedRole,
    menuPermissions: normalizedPermissions,
  });

  return getRolePermissionByRole(normalizedRole);
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
  normalizeRole,
  isValidRole,
  hasMenuPermission,
  validRoles,
};

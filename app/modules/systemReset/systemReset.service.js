const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const MasterPermissionService = require("../masterPermission/masterPermission.service");

const HARD_DELETE_CONFIRMATION = "HARD_DELETE";

const PROTECTED_MODEL_KEYS = new Set([
  "user",
  "rolePermission",
  "masterPermission",
  "userLogHistory",
  "logo",
  "salary",
  "codCharge",
  "codChange",
  "deliveryCharge",
  "deliveryAdvance",
]);

const isModel = (value) =>
  value &&
  typeof value.count === "function" &&
  typeof value.destroy === "function" &&
  typeof value.findAll === "function" &&
  typeof value.getTableName === "function";

const getResettableModels = () =>
  Object.entries(db)
    .filter(([key, value]) => !PROTECTED_MODEL_KEYS.has(key) && isModel(value))
    .map(([key, model]) => ({ key, model }));

const assertResetAccess = async (user, confirmation) => {
  const hasMasterPermission = await MasterPermissionService.isMasterEmail(
    user?.Email || user?.email,
  );

  if (user?.role !== "superAdmin" || !hasMasterPermission) {
    throw new ApiError(403, "Only the reset owner can hard delete data.");
  }

  if (confirmation !== HARD_DELETE_CONFIRMATION) {
    throw new ApiError(400, "Hard delete confirmation is required.");
  }
};

const deleteAllFromModel = async (model, transaction) => {
  const count = await model.count({ paranoid: false, transaction });
  if (!count) return { deleted: 0, total: 0 };

  const deleted = await model.destroy({
    where: {},
    force: true,
    hooks: false,
    individualHooks: false,
    transaction,
  });

  return { deleted, total: count };
};

const deleteEightyPercentFromModel = async (model, transaction) => {
  const total = await model.count({ paranoid: false, transaction });
  const deleteCount = Math.floor(total * 0.8);
  if (!deleteCount) return { deleted: 0, total };

  const primaryKey = model.primaryKeyAttribute || "Id";
  const rows = await model.findAll({
    attributes: [primaryKey],
    limit: deleteCount,
    order: [[primaryKey, "ASC"]],
    paranoid: false,
    raw: true,
    transaction,
  });

  const ids = rows.map((row) => row[primaryKey]).filter(Boolean);
  if (!ids.length) return { deleted: 0, total };

  const deleted = await model.destroy({
    where: { [primaryKey]: ids },
    force: true,
    hooks: false,
    individualHooks: false,
    transaction,
  });

  return { deleted, total };
};

const resetData = async ({ mode, confirmation, user }) => {
  await assertResetAccess(user, confirmation);

  const normalizedMode = mode === "all" ? "all" : "eightyPercent";
  const resettableModels = getResettableModels();
  const transaction = await db.sequelize.transaction();

  try {
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction });

    const results = [];
    for (const { key, model } of resettableModels) {
      const result =
        normalizedMode === "all"
          ? await deleteAllFromModel(model, transaction)
          : await deleteEightyPercentFromModel(model, transaction);

      results.push({ model: key, ...result });
    }

    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction });
    await transaction.commit();

    return {
      mode: normalizedMode,
      protectedModels: Array.from(PROTECTED_MODEL_KEYS),
      deletedTotal: results.reduce((sum, item) => sum + Number(item.deleted || 0), 0),
      results,
    };
  } catch (error) {
    await transaction.rollback();
    try {
      await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (_) {
      // Best effort to restore FK checks after a failed reset.
    }
    throw error;
  }
};

module.exports = {
  resetData,
};

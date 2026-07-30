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

const shuffle = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const normalizeDeletePercentage = (mode, percentage) => {
  if (mode === "all") return 100;

  const parsed = Number(percentage);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    throw new ApiError(400, "Delete percentage must be between 1 and 100.");
  }

  return parsed;
};

const deletePercentageFromModel = async (model, transaction, percentage) => {
  const total = await model.count({ paranoid: false, transaction });
  const deleteCount = Math.floor(total * (percentage / 100));
  if (!deleteCount) return { deleted: 0, total };

  const primaryKey = model.primaryKeyAttribute || "Id";
  const rows = await model.findAll({
    attributes: [primaryKey],
    paranoid: false,
    raw: true,
    transaction,
  });

  const ids = shuffle(rows.map((row) => row[primaryKey]).filter(Boolean)).slice(
    0,
    deleteCount,
  );
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

const resetData = async ({ mode, percentage, confirmation, user }) => {
  await assertResetAccess(user, confirmation);

  const normalizedMode = mode === "all" ? "all" : "percentage";
  const deletePercentage = normalizeDeletePercentage(normalizedMode, percentage);
  const resettableModels = getResettableModels();
  const transaction = await db.sequelize.transaction();

  try {
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction });

    const results = [];
    for (const { key, model } of resettableModels) {
      const result =
        normalizedMode === "all"
          ? await deleteAllFromModel(model, transaction)
          : await deletePercentageFromModel(model, transaction, deletePercentage);

      results.push({ model: key, ...result });
    }

    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction });
    await transaction.commit();

    return {
      mode: normalizedMode,
      deletePercentage,
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

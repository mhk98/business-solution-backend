const { Op, fn, col, where } = require("sequelize");
const ApiError = require("../error/ApiError");

/**
 * Guard against duplicate names on create/update.
 *
 * Matches case-insensitively and ignores leading/trailing spaces, and skips
 * soft-deleted rows (paranoid) so a deleted name can be reused. On update pass
 * `excludeId` so a record does not clash with itself.
 *
 * @param {import("sequelize").ModelStatic} Model  Sequelize model to check against.
 * @param {string} rawName                         The incoming name value.
 * @param {object} [options]
 * @param {number|string|null} [options.excludeId] Primary key to exclude (update case).
 * @param {string} [options.label]                 Human label used in the error message.
 * @param {string} [options.field]                 Column to compare (defaults to "name").
 */
const ensureUniqueName = async (
  Model,
  rawName,
  { excludeId = null, label = "Name", field = "name" } = {},
) => {
  const value = String(rawName ?? "").trim();
  if (!value) return; // blank values are handled by the caller's required-field checks

  const conditions = [
    where(fn("LOWER", fn("TRIM", col(field))), value.toLowerCase()),
  ];

  if (excludeId !== null && excludeId !== undefined && excludeId !== "") {
    conditions.push({ Id: { [Op.ne]: excludeId } });
  }

  const existing = await Model.findOne({
    where: { [Op.and]: conditions },
    attributes: ["Id"],
    paranoid: true,
  });

  if (existing) {
    throw new ApiError(409, `${label} "${value}" already exists`);
  }
};

module.exports = ensureUniqueName;

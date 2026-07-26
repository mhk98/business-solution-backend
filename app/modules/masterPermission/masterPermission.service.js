const ApiError = require("../../../error/ApiError");
const db = require("../../../models");

const MasterPermission = db.masterPermission;
const DEFAULT_MASTER_EMAIL = "ndhrubotara7@gmail.com";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const ensureDefaultMasterPermission = async () => {
  await MasterPermission.findOrCreate({
    where: { email: DEFAULT_MASTER_EMAIL },
    defaults: { email: DEFAULT_MASTER_EMAIL },
  });
};

const getAllFromDB = async () => {
  await ensureDefaultMasterPermission();
  return MasterPermission.findAll({
    order: [["email", "ASC"]],
  });
};

const isMasterEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  if (normalizedEmail === DEFAULT_MASTER_EMAIL) return true;

  await ensureDefaultMasterPermission();
  const row = await MasterPermission.findOne({
    where: { email: normalizedEmail },
  });

  return Boolean(row);
};

const assertMasterUser = async (user) => {
  const allowed = await isMasterEmail(user?.Email || user?.email);
  if (!allowed) {
    throw new ApiError(403, "Only master permission users can manage this.");
  }
};

const getSelfPermission = async (user) => {
  const canManageMasterPermission = await isMasterEmail(user?.Email || user?.email);
  return { canManageMasterPermission };
};

const insertIntoDB = async (payload, actor) => {
  await assertMasterUser(actor);

  const email = normalizeEmail(payload?.email);
  if (!email || !email.includes("@")) {
    throw new ApiError(400, "Valid email is required");
  }

  const [row] = await MasterPermission.findOrCreate({
    where: { email },
    defaults: {
      email,
      createdByUserId: actor?.Id || actor?.id || null,
    },
  });

  return row;
};

const deleteFromDB = async (id, actor) => {
  await assertMasterUser(actor);

  const row = await MasterPermission.findByPk(id);
  if (!row) {
    throw new ApiError(404, "Master permission email not found");
  }

  if (normalizeEmail(row.email) === DEFAULT_MASTER_EMAIL) {
    throw new ApiError(400, "Default master email cannot be removed");
  }

  await row.destroy();
  return row;
};

module.exports = {
  DEFAULT_MASTER_EMAIL,
  normalizeEmail,
  ensureDefaultMasterPermission,
  getAllFromDB,
  getSelfPermission,
  isMasterEmail,
  assertMasterUser,
  insertIntoDB,
  deleteFromDB,
};

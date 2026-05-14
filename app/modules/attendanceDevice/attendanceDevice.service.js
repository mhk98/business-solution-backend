const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  AttendanceDeviceSearchableFields,
} = require("./attendanceDevice.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const AttendanceDevice = db.attendanceDevice;

const randomToken = (length = 24) =>
  Math.random().toString(36).slice(2) +
  Math.random().toString(36).slice(2, 2 + Math.max(0, length - 10));

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildDevicePayload = (data = {}, existing = {}) => {
  const code = String(data.code || existing.code || "").trim();
  const name = String(data.name || existing.name || "").trim();
  const branch = String(data.branch || existing.branch || "").trim();

  const fallbackIdentifier = [branch, code, name]
    .map(slugify)
    .filter(Boolean)
    .join("-") || `device-${Date.now()}`;

  return {
    ...data,
    code: code || null,
    brand: data.brand || existing.brand || "ZKTeco",
    model: data.model || existing.model || "SpeedFace-V5L",
    deviceIdentifier:
      String(data.deviceIdentifier || "").trim() ||
      existing.deviceIdentifier ||
      fallbackIdentifier,
    apiKey:
      String(data.apiKey || "").trim() ||
      existing.apiKey ||
      `att_${randomToken(28)}`,
  };
};

const insertIntoDB = async (data, user) => {
  const result = await AttendanceDevice.create(
    applyCreateWorkflow(buildDevicePayload(data), user),
  );
  return getDataById(result.Id);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: AttendanceDeviceSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    andConditions.push({
      [key]: { [Op.eq]: value },
    });
  });

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const data = await AttendanceDevice.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await AttendanceDevice.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return AttendanceDevice.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const getDataById = async (id) => {
  return AttendanceDevice.findOne({
    where: { Id: id },
  });
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Attendance device not found");
  }
  const data = buildDevicePayload(payload, existing || {});

  await AttendanceDevice.update(applyUpdateWorkflow(data, user), {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Attendance device not found");
  }

  if (isPrivilegedRole(user.role)) {
    await AttendanceDevice.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await AttendanceDevice.update(buildDeleteWorkflowPayload(note, user), {
    where: { Id: id },
  });

  return {
    ...(await getDataById(id))?.get({ plain: true }),
    workflowAction: "delete_requested",
  };
};

const approveOneFromDB = async (id) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Attendance device not found");
  }

  if (existing.pendingAction === "Delete") {
    await AttendanceDevice.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await AttendanceDevice.update(
    {
      status: "Active",
      pendingAction: null,
      approvalNote: null,
      requestedByUserId: null,
    },
    { where: { Id: id } },
  );

  return {
    ...(await getDataById(id))?.get({ plain: true }),
    workflowAction: "approved",
  };
};

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  approveOneFromDB,
};

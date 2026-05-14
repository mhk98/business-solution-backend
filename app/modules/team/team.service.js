const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { TeamSearchableFields } = require("./team.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const Team = db.team;
const Department = db.department;

const teamInclude = [
  {
    model: Department,
    as: "department",
    attributes: ["Id", "name", "code", "status"],
    required: false,
  },
];

const normalizeRequiredId = (value, fieldLabel) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new ApiError(400, `${fieldLabel} is required`);
  }

  const id = Number(value);
  if (!Number.isFinite(id)) {
    throw new ApiError(400, `${fieldLabel} must be valid`);
  }

  return id;
};

const normalizeTeamPayload = (payload = {}) => {
  const normalized = { ...payload };
  const name = String(normalized.name || "").trim();

  if (!name) {
    throw new ApiError(400, "Team Name is required");
  }

  normalized.departmentId = normalizeRequiredId(
    normalized.departmentId,
    "Department",
  );
  normalized.name = name;
  if (normalized.code !== undefined) {
    normalized.code = String(normalized.code || "").trim() || null;
  }
  if (normalized.description !== undefined) {
    normalized.description = String(normalized.description || "").trim() || null;
  }

  return normalized;
};

const getDataById = async (id) => {
  return Team.findOne({
    where: { Id: id },
    include: teamInclude,
  });
};

const insertIntoDB = async (data, user) => {
  const normalized = normalizeTeamPayload(data);
  const result = await Team.create(applyCreateWorkflow(normalized, user));
  return getDataById(result.Id);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: TeamSearchableFields.map((field) => ({
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

  const data = await Team.findAll({
    where: whereConditions,
    include: teamInclude,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Team.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return Team.findAll({
    include: teamInclude,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Team not found");
  }

  const normalized = normalizeTeamPayload(payload);

  await Team.update(applyUpdateWorkflow(normalized, user), {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Team not found");
  }

  if (isPrivilegedRole(user.role)) {
    await Team.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await Team.update(buildDeleteWorkflowPayload(note, user), {
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
    throw new ApiError(404, "Team not found");
  }

  if (existing.pendingAction === "Delete") {
    await Team.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await Team.update(
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

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DepartmentSearchableFields } = require("./department.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const Department = db.department;

const normalizeDepartmentPayload = (payload = {}) => {
  const normalized = { ...payload };
  const name = String(normalized.name || "").trim();

  if (!name) {
    throw new ApiError(400, "Department Name is required");
  }

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
  return Department.findOne({
    where: { Id: id },
  });
};

const insertIntoDB = async (data, user) => {
  const normalized = normalizeDepartmentPayload(data);
  const result = await Department.create(applyCreateWorkflow(normalized, user));
  return getDataById(result.Id);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DepartmentSearchableFields.map((field) => ({
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

  const data = await Department.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Department.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return Department.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Department not found");
  }

  const normalized = normalizeDepartmentPayload(payload);

  await Department.update(applyUpdateWorkflow(normalized, user), {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Department not found");
  }

  if (isPrivilegedRole(user.role)) {
    await Department.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await Department.update(buildDeleteWorkflowPayload(note, user), {
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
    throw new ApiError(404, "Department not found");
  }

  if (existing.pendingAction === "Delete") {
    await Department.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await Department.update(
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

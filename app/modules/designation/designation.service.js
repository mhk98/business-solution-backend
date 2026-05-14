const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DesignationSearchableFields } = require("./designation.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const Designation = db.designation;
const Department = db.department;

const designationInclude = [
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

const normalizeDesignationPayload = (payload = {}) => {
  const normalized = { ...payload };
  const name = String(normalized.name || "").trim();

  if (!name) {
    throw new ApiError(400, "Designation Name is required");
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

const insertIntoDB = async (data, user) => {
  const normalized = normalizeDesignationPayload(data);
  const result = await Designation.create(applyCreateWorkflow(normalized, user));
  return Designation.findOne({
    where: { Id: result.Id },
    include: designationInclude,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DesignationSearchableFields.map((field) => ({
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

  const data = await Designation.findAll({
    where: whereConditions,
    include: designationInclude,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Designation.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return Designation.findAll({
    include: designationInclude,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const getDataById = async (id) => {
  return Designation.findOne({
    where: { Id: id },
    include: designationInclude,
  });
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Designation not found");
  }

  const normalized = normalizeDesignationPayload(payload);

  await Designation.update(applyUpdateWorkflow(normalized, user), {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Designation not found");
  }

  if (isPrivilegedRole(user.role)) {
    await Designation.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await Designation.update(buildDeleteWorkflowPayload(note, user), {
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
    throw new ApiError(404, "Designation not found");
  }

  if (existing.pendingAction === "Delete") {
    await Designation.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await Designation.update(
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

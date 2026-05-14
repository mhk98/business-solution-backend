const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ShiftSearchableFields } = require("./shift.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const Shift = db.shift;

const insertIntoDB = async (data, user) => {
  const result = await Shift.create(applyCreateWorkflow(data, user));
  return getDataById(result.Id);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ShiftSearchableFields.map((field) => ({
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

  const data = await Shift.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Shift.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return Shift.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const getDataById = async (id) => {
  return Shift.findOne({
    where: { Id: id },
  });
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Shift not found");
  }

  await Shift.update(applyUpdateWorkflow(payload, user), {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Shift not found");
  }

  if (isPrivilegedRole(user.role)) {
    await Shift.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await Shift.update(buildDeleteWorkflowPayload(note, user), {
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
    throw new ApiError(404, "Shift not found");
  }

  if (existing.pendingAction === "Delete") {
    await Shift.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await Shift.update(
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

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { HolidaySearchableFields } = require("./holiday.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const Holiday = db.holiday;

const normalizeHolidayPayload = (payload = {}) => {
  const startDate = payload.startDate || payload.holidayDate;
  const endDate = payload.endDate || payload.startDate || payload.holidayDate;

  if (!startDate || !endDate) {
    throw new ApiError(400, "startDate and endDate are required");
  }

  if (String(endDate) < String(startDate)) {
    throw new ApiError(400, "endDate cannot be earlier than startDate");
  }

  return {
    ...payload,
    holidayDate: startDate,
    startDate,
    endDate,
  };
};

const insertIntoDB = async (data, user) => {
  const result = await Holiday.create(
    applyCreateWorkflow(normalizeHolidayPayload(data), user),
  );
  return getDataById(result.Id);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: HolidaySearchableFields.map((field) => ({
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

  const data = await Holiday.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["startDate", "DESC"]],
  });

  const count = await Holiday.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return Holiday.findAll({
    paranoid: true,
    order: [["startDate", "DESC"]],
  });
};

const getDataById = async (id) => {
  return Holiday.findOne({
    where: { Id: id },
  });
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Holiday not found");
  }

  await Holiday.update(
    applyUpdateWorkflow(normalizeHolidayPayload(payload), user),
    {
      where: { Id: id },
    },
  );

  return getDataById(id);
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await getDataById(id);
  if (!existing) {
    throw new ApiError(404, "Holiday not found");
  }

  if (isPrivilegedRole(user.role)) {
    await Holiday.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await Holiday.update(buildDeleteWorkflowPayload(note, user), {
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
    throw new ApiError(404, "Holiday not found");
  }

  if (existing.pendingAction === "Delete") {
    await Holiday.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await Holiday.update(
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

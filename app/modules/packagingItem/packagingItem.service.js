const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const {
  PackagingItemSearchableFields,
} = require("./packagingItem.constants");

const PackagingItem = db.packagingItem;

const insertIntoDB = async (data) => {
  const result = await PackagingItem.create({
    name: data.name,
    date: data.date || null,
    note: data.note || null,
    status: data.status || "Active",
  });

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingItemSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => ({
          [key]: { [Op.eq]: value },
        })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      createdAt: { [Op.between]: [start, end] },
    });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await PackagingItem.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await PackagingItem.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await PackagingItem.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await PackagingItem.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await PackagingItem.update(
    {
      name: payload.name,
      date: payload.date || null,
      note: payload.note || null,
      status: payload.status || "Active",
    },
    {
      where: {
        Id: id,
      },
    },
  );

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PackagingItem.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const PackagingItemService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PackagingItemService;

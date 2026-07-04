const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { ManufacturerSearchableFields } = require("./manufacturer.constants");

const Manufacturer = db.manufacturer;

const insertIntoDB = async (data) => {
  return Manufacturer.create({
    name: data.name,
    phone: data.phone || null,
    address: data.address || null,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      [Op.or]: ManufacturerSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value) {
      andConditions.push({
        [key]: { [Op.like]: `%${String(value).trim()}%` },
      });
    }
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const data = await Manufacturer.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Manufacturer.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  return Manufacturer.findOne({
    where: { Id: id },
  });
};

const deleteIdFromDB = async (id) => {
  return Manufacturer.destroy({
    where: { Id: id },
  });
};

const updateOneFromDB = async (id, payload) => {
  return Manufacturer.update(
    {
      name: payload.name,
      phone: payload.phone || null,
      address: payload.address || null,
    },
    {
      where: { Id: id },
    },
  );
};

const getAllFromDBWithoutQuery = async () => {
  return Manufacturer.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const ManufacturerService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ManufacturerService;

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const {
  ManufactureStockSearchableFields,
} = require("./manufactureStock.constants");

const ManufactureStock = db.manufactureStock;

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureStockSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
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

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count, totalQuantity] = await Promise.all([
    ManufactureStock.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    ManufactureStock.count({ where: whereConditions }),
    ManufactureStock.sum("unitValue", { where: whereConditions }),
  ]);

  return {
    meta: { count, page, limit, totalQuantity: totalQuantity || 0 },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const data = await ManufactureStock.findAll({
    where: { productId: id },
  });

  return data.map(formatStockForDisplay);
};

const getAllFromDBWithoutQuery = async () => {
  const data = await ManufactureStock.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return data.map(formatStockForDisplay);
};

const ManufactureStockService = {
  getAllFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ManufactureStockService;

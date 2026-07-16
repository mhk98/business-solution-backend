const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const {
  PackagingItemStockSearchableFields,
} = require("./packagingItemStock.constants");

const PackagingItemStock = db.packagingItemStock;

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingItemStockSearchableFields.map((field) => ({
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
    andConditions.push({ createdAt: { [Op.between]: [start, end] } });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count, totalQuantity] = await Promise.all([
    PackagingItemStock.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingItemStock.count({ where: whereConditions }),
    PackagingItemStock.sum("unitValue", { where: whereConditions }),
  ]);

  return {
    meta: { count, page, limit, totalQuantity: totalQuantity || 0 },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const data = await PackagingItemStock.findAll({
    where: { packagingItemId: id },
  });
  return data.map(formatStockForDisplay);
};

const getAllFromDBWithoutQuery = async () => {
  const data = await PackagingItemStock.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(formatStockForDisplay);
};

module.exports = {
  getAllFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

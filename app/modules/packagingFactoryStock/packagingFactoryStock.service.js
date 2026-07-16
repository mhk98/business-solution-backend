const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const {
  PackagingFactoryStockSearchableFields,
} = require("./packagingFactoryStock.constants");

const PackagingFactoryStock = db.packagingFactoryStock;

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingFactoryStockSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({ createdAt: { [Op.between]: [start, end] } });
  }

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};
  const [data, count, totalQuantity] = await Promise.all([
    PackagingFactoryStock.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingFactoryStock.count({ where: whereConditions }),
    PackagingFactoryStock.sum("unitValue", { where: whereConditions }),
  ]);

  return {
    meta: { count, page, limit, totalQuantity: totalQuantity || 0 },
    data: data.map(formatStockForDisplay),
  };
};

const getAllFromDBWithoutQuery = async () => {
  const data = await PackagingFactoryStock.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(formatStockForDisplay);
};

module.exports = {
  getAllFromDB,
  getAllFromDBWithoutQuery,
};

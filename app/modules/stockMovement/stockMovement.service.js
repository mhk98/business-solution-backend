const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const {
  StockMovementSearchableFields,
} = require("./stockMovement.constants");

const StockMovement = db.stockMovement;

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: StockMovementSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

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

  const [data, count] = await Promise.all([
    StockMovement.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    StockMovement.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data,
  };
};

const getDataById = async (id) => {
  return StockMovement.findOne({ where: { Id: id } });
};

// Distinct item/product names that have actually appeared in the movement
// log — spans every stockType (ItemStock, FactoryStock, ProductStock,
// PackagingStock) since `name` is denormalized onto every row, unlike
// productId/itemId which are separate, only-sometimes-populated id spaces.
const getDistinctNames = async () => {
  const rows = await StockMovement.findAll({
    attributes: [
      [db.Sequelize.fn("DISTINCT", db.Sequelize.col("name")), "name"],
    ],
    where: { name: { [Op.ne]: null } },
    order: [["name", "ASC"]],
    raw: true,
  });

  return rows.map((row) => row.name).filter(Boolean);
};

module.exports = {
  getAllFromDB,
  getDataById,
  getDistinctNames,
};

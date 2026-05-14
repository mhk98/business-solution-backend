const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ItemMasterSearchableFields } = require("./itemMaster.constants");
const ItemMaster = db.itemMaster;

const insertIntoDB = async (data) => {
  const result = await ItemMaster.create(data);

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ItemMasterSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      createdAt: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  // ✅ paginated data
  const data = await ItemMaster.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // ✅ total count + total quantity (same filters)
  // const [count, totalQuantity] = await Promise.all([
  //   ItemMaster.count({ where: whereConditions }),
  //   ItemMaster.sum("quantity", { where: whereConditions }),
  // ]);

  return {
    meta: {
      // count, // total filtered records
      // totalQuantity: totalQuantity || 0, // total filtered quantity
      page,
      limit,
    },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const result = await ItemMaster.findAll({
    where: {
      productId: id,
    },
  });

  return result.map(formatStockForDisplay);
};

const deleteIdFromDB = async (id) => {
  const result = await ItemMaster.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await ItemMaster.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await ItemMaster.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result.map(formatStockForDisplay);
};

const ItemMasterService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ItemMasterService;

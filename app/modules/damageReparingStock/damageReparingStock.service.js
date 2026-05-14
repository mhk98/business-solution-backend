const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  DamageReparingStockSearchableFields,
} = require("./damageReparingStock.constants");
const parseVariants = require("../../../shared/parseVariants");

const DamageReparingStock = db.damageReparingStock;

const getVariantQuantityTotal = (variants) =>
  parseVariants(variants).reduce(
    (total, variant) => total + (Number(variant?.quantity) || 0),
    0,
  );

const assertQuantityMatchesExistingVariants = (row, nextQuantity) => {
  const variants = parseVariants(row?.variants);
  if (!variants.length || nextQuantity === undefined) return;

  const variantTotal = getVariantQuantityTotal(variants);
  if (Number(nextQuantity || 0) !== variantTotal) {
    throw new ApiError(
      400,
      "Quantity must match existing variant quantity total",
    );
  }
};

const insertIntoDB = async (data) => {
  const result = await DamageReparingStock.create(data);

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DamageReparingStockSearchableFields.map((field) => ({
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
  const data = await DamageReparingStock.findAll({
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
  const [count, totalQuantity] = await Promise.all([
    DamageReparingStock.count({ where: whereConditions }),
    DamageReparingStock.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: {
      count, // total filtered records
      totalQuantity: totalQuantity || 0, // total filtered quantity
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) => {
  const result = await DamageReparingStock.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await DamageReparingStock.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const existing = await DamageReparingStock.findOne({
    where: {
      Id: id,
    },
  });

  if (!existing) throw new ApiError(404, "DamageReparingStock not found");

  assertQuantityMatchesExistingVariants(existing, payload.quantity);

  const result = await DamageReparingStock.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await DamageReparingStock.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const DamageReparingStockService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DamageReparingStockService;

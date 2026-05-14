const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ProductSearchableFields } = require("./product.constants");
const Product = db.product;
const Variation = db.variation;

const insertIntoDB = async (data) => {
  const { name, size, color, sku } = data;

  const payload = {
    name,
    sku,
  };

  const result = await Product.create(payload);

  if (size || color) {
    const variationData = {
      size: size || null,
      color: color || null,
      productId: result.Id, // Associate with the created product
    };
    await Variation.create(variationData);
  }

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ProductSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Product.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Variation,
        as: "variations",
      },
    ],
    paranoid: true,
    order: (() => {
      const ALLOWED_SORT_COLUMNS = new Set([
        "createdAt", "updatedAt", "name", "price", "stock",
      ]);
      const ALLOWED_SORT_ORDERS = new Set(["ASC", "DESC"]);
      const col = options.sortBy;
      const ord = (options.sortOrder || "").toUpperCase();
      if (col && ALLOWED_SORT_COLUMNS.has(col) && ALLOWED_SORT_ORDERS.has(ord)) {
        return [[col, ord]];
      }
      return [["createdAt", "DESC"]];
    })(),
  });

  const count = await Product.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Product.findOne({
    where: {
      stockId: id,
    },
    include: [
      {
        model: db.variation,
        as: "variations",
      },
    ],
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Product.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { name, size, color, sku } = payload;

  const data = {
    name,
    sku,
  };
  const result = await Product.update(data, {
    where: {
      Id: id,
    },
  });

  const existingVariation = await Variation.findOne({
    where: { productId: id },
  });

  if (existingVariation) {
    await Variation.update(
      {
        size: size || existingVariation.size,
        color: color || existingVariation.color,
      },
      {
        where: { productId: id },
      },
    );
  } else if (size || color) {
    const variationData = {
      size: size || null,
      color: color || null,
      productId: id,
    };
    await Variation.create(variationData);
  }

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Product.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const getReceivedDataById = async (id) => {
  const result = await Product.findOne({
    where: {
      Id: id,
    },
    include: [
      {
        model: db.variation,
        as: "variations",
      },
    ],
  });

  return result;
};

const ProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getReceivedDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ProductService;

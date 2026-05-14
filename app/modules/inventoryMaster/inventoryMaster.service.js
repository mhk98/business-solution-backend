const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  InventoryMasterSearchableFields,
} = require("./inventoryMaster.constants");
const {
  getInventoryDisplayQuantity,
  normalizeInventoryQuantityForDisplay,
} = require("../../../shared/variantQuantity");

const InventoryMaster = db.inventoryMaster;
const Supplier = db.supplier;
const Warehouse = db.warehouse;

const n = (value) => Number(value || 0);

const insertIntoDB = async (data) => {
  const result = await InventoryMaster.create(data);

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: InventoryMasterSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
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

  // ✅ total count + total quantity (same filters)
  const [data, count, quantityRows] = await Promise.all([
    InventoryMaster.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    InventoryMaster.count({ where: whereConditions }),
    InventoryMaster.findAll({
      where: whereConditions,
      attributes: ["quantity", "variants"],
      paranoid: true,
    }),
  ]);
  const totalQuantity = quantityRows.reduce(
    (sum, row) => sum + getInventoryDisplayQuantity(row),
    0,
  );

  return {
    meta: {
      count, // total filtered records
      totalQuantity: totalQuantity || 0, // total filtered quantity
      page,
      limit,
    },
    data: data.map(normalizeInventoryQuantityForDisplay),
  };
};

const getDataById = async (id) => {
  const result = await InventoryMaster.findOne({
    where: {
      Id: id,
    },
  });

  return normalizeInventoryQuantityForDisplay(result);
};

const deleteIdFromDB = async (id) => {
  const result = await InventoryMaster.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await InventoryMaster.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await InventoryMaster.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result.map(normalizeInventoryQuantityForDisplay);
};

const getLowStockProductsFromDB = async () => {
  const result = await InventoryMaster.findAll({
    where: {
      deletedAt: {
        [Op.is]: null,
      },
    },
    paranoid: true,
    order: [
      ["quantity", "ASC"],
      ["createdAt", "DESC"],
    ],
  });

  return result
    .map((row) => ({
      ...normalizeInventoryQuantityForDisplay(row),
      minimumStock: n(row.minimumStock),
    }))
    .filter((row) => n(row.quantity) <= n(row.minimumStock));
};

const InventoryMasterService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getLowStockProductsFromDB,
};

module.exports = InventoryMasterService;

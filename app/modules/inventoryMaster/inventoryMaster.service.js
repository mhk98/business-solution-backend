const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  InventoryMasterSearchableFields,
} = require("./inventoryMaster.constants");
const {
  getInventoryDisplayQuantity,
  getInventoryStockBalance,
  normalizeInventoryQuantityForDisplay,
} = require("../../../shared/variantQuantity");
const parseVariants = require("../../../shared/parseVariants");
const {
  calculateExpectedInventoryForProduct,
  reconcileInventoryForProduct,
} = require("../../../shared/inventoryMovementReconciler");

const InventoryMaster = db.inventoryMaster;
const Product = db.product;
const Variation = db.variation;
const Supplier = db.supplier;
const Warehouse = db.warehouse;

const productVariationInclude = {
  model: Product,
  attributes: ["Id", "name"],
  include: [
    {
      model: Variation,
      as: "variations",
      attributes: ["Id", "size", "color", "weight", "unit"],
    },
  ],
};

const n = (value) => Number(value || 0);

const variantKey = (variant = {}) =>
  `${String(variant.size || "")}__${String(variant.color || "")}`;

const normalizeVariantDiffRows = (currentVariants, expectedVariants) => {
  const currentMap = new Map();
  const expectedMap = new Map();

  parseVariants(currentVariants).forEach((variant) => {
    currentMap.set(variantKey(variant), {
      size: variant.size || "",
      color: variant.color || "",
      currentQuantity: n(variant.quantity),
      expectedQuantity: 0,
    });
  });

  parseVariants(expectedVariants).forEach((variant) => {
    const key = variantKey(variant);
    const existing = currentMap.get(key) || {
      size: variant.size || "",
      color: variant.color || "",
      currentQuantity: 0,
      expectedQuantity: 0,
    };
    expectedMap.set(key, true);
    currentMap.set(key, {
      ...existing,
      size: existing.size || variant.size || "",
      color: existing.color || variant.color || "",
      expectedQuantity: n(variant.quantity),
    });
  });

  return Array.from(currentMap.values())
    .filter(
      (row) =>
        row.currentQuantity !== row.expectedQuantity ||
        expectedMap.has(variantKey(row)),
    )
    .map((row) => ({
      ...row,
      diff: row.currentQuantity - row.expectedQuantity,
    }));
};

const buildAuditRow = async (inventoryRow) => {
  const row =
    typeof inventoryRow?.get === "function"
      ? inventoryRow.get({ plain: true })
      : inventoryRow;
  const productId = Number(row?.productId || 0);
  if (!productId) return null;

  const expected = await calculateExpectedInventoryForProduct(db, productId);
  if (!expected) return null;

  const currentQuantity = getInventoryDisplayQuantity(row);
  const expectedQuantity = n(expected.quantity);
  const currentVariants = parseVariants(row.variants);
  const expectedVariants = parseVariants(expected.variants);
  const variantDiffs = normalizeVariantDiffRows(currentVariants, expectedVariants);
  const hasVariantMismatch = variantDiffs.some((variant) => variant.diff !== 0);
  const quantityDiff = currentQuantity - expectedQuantity;

  return {
    productId,
    inventoryId: row.Id,
    name: row.name || expected.product.name,
    currentQuantity,
    expectedQuantity,
    diff: quantityDiff,
    currentVariants,
    expectedVariants,
    variantDiffs,
    hasMismatch: quantityDiff !== 0 || hasVariantMismatch,
    updatedAt: row.updatedAt,
  };
};

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
      include: [productVariationInclude],
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    InventoryMaster.count({ where: whereConditions }),
    InventoryMaster.findAll({
      where: whereConditions,
      attributes: ["quantity", "variants", "purchase_price"],
      paranoid: true,
    }),
  ]);
  const totalQuantity = quantityRows.reduce(
    (sum, row) => sum + getInventoryDisplayQuantity(row),
    0,
  );
  const totalStockBalance = quantityRows.reduce(
    (sum, row) => sum + getInventoryStockBalance(row),
    0,
  );

  return {
    meta: {
      count, // total filtered records
      totalQuantity: totalQuantity || 0, // total filtered quantity
      totalStockBalance: totalStockBalance || 0,
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
    include: [productVariationInclude],
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
    include: [productVariationInclude],
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

const getStockMismatchAuditFromDB = async (filters = {}) => {
  const { productId, mismatchOnly = "true" } = filters;
  const where = {};
  if (productId) where.productId = Number(productId);

  const inventoryRows = await InventoryMaster.findAll({
    where,
    include: [productVariationInclude],
    paranoid: true,
    order: [["updatedAt", "DESC"]],
  });

  const auditRows = (
    await Promise.all(inventoryRows.map((row) => buildAuditRow(row)))
  ).filter(Boolean);

  const filteredRows =
    String(mismatchOnly) === "false"
      ? auditRows
      : auditRows.filter((row) => row.hasMismatch);

  return {
    totalProductsChecked: auditRows.length,
    totalMismatches: auditRows.filter((row) => row.hasMismatch).length,
    data: filteredRows,
  };
};

const fixStockMismatchFromDB = async (productId) => {
  if (!Number(productId)) {
    throw new ApiError(400, "productId is required");
  }

  await reconcileInventoryForProduct(db, Number(productId));

  const inventory = await InventoryMaster.findOne({
    where: { productId: Number(productId) },
    include: [productVariationInclude],
  });

  return buildAuditRow(inventory);
};

const InventoryMasterService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getLowStockProductsFromDB,
  getStockMismatchAuditFromDB,
  fixStockMismatchFromDB,
};

module.exports = InventoryMasterService;

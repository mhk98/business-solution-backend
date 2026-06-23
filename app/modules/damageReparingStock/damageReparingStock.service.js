const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  DamageReparingStockSearchableFields,
} = require("./damageReparingStock.constants");
const parseVariants = require("../../../shared/parseVariants");

const DamageReparingStock = db.damageReparingStock;
const DamageStock = db.damageStock;
const DamageRepair = db.damageRepair;
const DamageRepaired = db.damageRepaired;

const getVariantKey = (variant) =>
  `${String(variant?.size || "").trim()}__${String(variant?.color || "").trim()}`;

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

const mergeMissingHistoricalVariants = (currentVariants, historicalVariants) => {
  const map = new Map();

  parseVariants(currentVariants).forEach((variant) => {
    const key = getVariantKey(variant);
    if (key === "__") return;

    map.set(key, {
      ...variant,
      size: variant.size || "",
      color: variant.color || "",
      quantity: Number(variant.quantity || 0),
    });
  });

  parseVariants(historicalVariants).forEach((variant) => {
    const key = getVariantKey(variant);
    if (key === "__" || map.has(key)) return;

    map.set(key, {
      ...variant,
      size: variant.size || "",
      color: variant.color || "",
      quantity: 0,
    });
  });

  return Array.from(map.values());
};

const addHistoricalZeroVariants = async (rows) => {
  const rowList = Array.isArray(rows) ? rows : [];
  if (!rowList.length) return rows;

  const repairingStockIds = rowList.map((row) => row.Id).filter(Boolean);
  const productIds = rowList.map((row) => row.productId).filter(Boolean);

  const damageStockRows = await DamageStock.findAll({
    where: {
      deletedAt: { [Op.is]: null },
      productId: { [Op.in]: productIds.length ? productIds : [0] },
    },
    attributes: ["Id", "productId"],
    paranoid: true,
  });
  const catalogProductByDamageStockId = new Map(
    damageStockRows.map((row) => [Number(row.Id), Number(row.productId)]),
  );
  const damageStockIds = [...catalogProductByDamageStockId.keys()];

  const [repairRows, repairedRows] = await Promise.all([
    DamageRepair.findAll({
      where: {
        deletedAt: { [Op.is]: null },
        productId: { [Op.in]: damageStockIds.length ? damageStockIds : [0] },
      },
      attributes: ["productId", "variants"],
      paranoid: true,
    }),
    DamageRepaired.findAll({
      where: {
        deletedAt: { [Op.is]: null },
        productId: { [Op.in]: repairingStockIds.length ? repairingStockIds : [0] },
      },
      attributes: ["productId", "variants", "items"],
      paranoid: true,
    }),
  ]);

  const historyByProductId = new Map();
  const historyByRepairingStockId = new Map();

  repairRows.forEach((row) => {
    const key = catalogProductByDamageStockId.get(Number(row.productId));
    if (!key) return;
    if (!historyByProductId.has(key)) historyByProductId.set(key, []);
    historyByProductId.get(key).push(...parseVariants(row.variants));
  });

  repairedRows.forEach((row) => {
    const key = Number(row.productId);
    if (!historyByRepairingStockId.has(key)) {
      historyByRepairingStockId.set(key, []);
    }
    historyByRepairingStockId.get(key).push(...parseVariants(row.variants));

    parseVariants(row.items).forEach((item) => {
      const itemKey = Number(item.receivedId || item.productId);
      if (!itemKey) return;
      if (!historyByRepairingStockId.has(itemKey)) {
        historyByRepairingStockId.set(itemKey, []);
      }
      historyByRepairingStockId.get(itemKey).push(...parseVariants(item.variants));
    });
  });

  return rowList.map((row) => {
    const plainRow = row?.toJSON ? row.toJSON() : row;
    const historicalVariants = [
      ...(historyByProductId.get(Number(plainRow.productId)) || []),
      ...(historyByRepairingStockId.get(Number(plainRow.Id)) || []),
    ];

    return {
      ...plainRow,
      variants: mergeMissingHistoricalVariants(
        plainRow.variants,
        historicalVariants,
      ),
    };
  });
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
  const dataWithHistoricalVariants = await addHistoricalZeroVariants(data);

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
    data: dataWithHistoricalVariants,
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

  return addHistoricalZeroVariants(result);
};

const getAllRawFromDBWithoutQuery = async () => {
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
  getAllRawFromDBWithoutQuery,
};

module.exports = DamageReparingStockService;

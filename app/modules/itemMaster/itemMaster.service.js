const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ItemMasterSearchableFields } = require("./itemMaster.constants");
const {
  lastKnownUnitCostMap,
} = require("../../../shared/itemFifoCostLayers");
const ItemMaster = db.itemMaster;

const attachLastUnitCost = async (rows) => {
  if (!rows.length) return rows;
  const lastUnitCostMap = await lastKnownUnitCostMap(rows.map((r) => r.itemId));
  return rows.map((row) => ({
    ...row,
    lastUnitCost: lastUnitCostMap.get(Number(row.itemId)) || 0,
  }));
};

const normalizeStockPayload = (payload = {}) => {
  if (
    payload.unit === undefined &&
    payload.unitValue === undefined
  ) {
    return payload;
  }

  const normalized = toBaseStockPayload(
    payload.unit || "Pcs",
    payload.unitValue,
  );

  return {
    ...payload,
    unit: normalized.unit,
    unitValue: normalized.unitValue,
  };
};

const insertIntoDB = async (data) => {
  const result = await ItemMaster.create(normalizeStockPayload(data));

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

  const [count, totalQuantity, totalBalance] = await Promise.all([
    ItemMaster.count({ where: whereConditions }),
    ItemMaster.sum("unitValue", { where: whereConditions }),
    ItemMaster.sum("cost", { where: whereConditions }),
  ]);

  return {
    meta: {
      count,
      totalQuantity: totalQuantity || 0,
      totalBalance: Number(totalBalance || 0),
      page,
      limit,
    },
    data: await attachLastUnitCost(data.map(formatStockForDisplay)),
  };
};

const getDataById = async (id) => {
  const result = await ItemMaster.findAll({
    where: {
      productId: id,
    },
  });

  return attachLastUnitCost(result.map(formatStockForDisplay));
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
  const result = await ItemMaster.update(normalizeStockPayload(payload), {
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

  return attachLastUnitCost(result.map(formatStockForDisplay));
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

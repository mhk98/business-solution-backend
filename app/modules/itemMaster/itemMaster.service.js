const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  toBaseStockPayload,
} = require("../../../helpers/unitConversionHelper");
const { isAverageCostLive } = require("../../../shared/averageCostRunner");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  createWithStockLog,
  updateWithStockLog,
  destroyWithStockLog,
} = require("../../../shared/directStockEdit");
const { ItemMasterSearchableFields } = require("./itemMaster.constants");
const { buildItemUnitCostResolver, baseOf } = require("../../../shared/itemUnitCostResolver");
const ItemMaster = db.itemMaster;

// Item Stock always shows quantity/unit exactly as purchased (e.g. Ml, not
// auto-converted to Liter) — formatStockForDisplay's Ml->Liter/Gram->Kg
// conversion rewrites unitValue for display but leaves cost untouched,
// which silently corrupts the Unit Cost column (cost ends up divided by the
// converted quantity instead of the one it was actually priced against).
const toPlainStockRow = (record) => (record?.toJSON ? record.toJSON() : { ...record });

const attachLastUnitCost = async (rows) => {
  if (!rows.length) return rows;
  const unitCostOf = await buildItemUnitCostResolver();
  // After weighted-average go-live the row's own average (cost ÷ quantity) is
  // the unit cost; the last purchase price only fills in for empty stock.
  const averageLive = await isAverageCostLive();
  return rows.map((row) => {
    const quantity = baseOf(row.unit, row.unitValue);
    const average = quantity > 0 ? Number(row.cost) / quantity : 0;
    const unitCost = averageLive && quantity > 0 ? average : unitCostOf(row.itemId, average);
    return { ...row, unitCost, lastUnitCost: unitCost };
  });
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
  const result = await createWithStockLog(ItemMaster, "ItemStock", normalizeStockPayload(data));

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
    data: await attachLastUnitCost(data.map(toPlainStockRow)),
  };
};

const getDataById = async (id) => {
  const result = await ItemMaster.findAll({
    where: {
      productId: id,
    },
  });

  return attachLastUnitCost(result.map(toPlainStockRow));
};

const deleteIdFromDB = async (id) => {
  const result = await destroyWithStockLog(ItemMaster, "ItemStock", { Id: id });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await updateWithStockLog(ItemMaster, "ItemStock", { Id: id }, normalizeStockPayload(payload));

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await ItemMaster.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return attachLastUnitCost(result.map(toPlainStockRow));
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

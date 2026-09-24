const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const { isAverageCostLive } = require("../../../shared/averageCostRunner");
const db = require("../../../models");
const {
  ManufactureStockSearchableFields,
} = require("./manufactureStock.constants");
const {
  buildItemUnitCostResolver,
  baseOf,
} = require("../../../shared/itemUnitCostResolver");

const ManufactureStock = db.manufactureStock;

// Factory Stock always shows quantity/unit exactly as recorded (e.g. Ml, not
// auto-converted to Liter) — formatStockForDisplay's Ml->Liter/Gram->Kg
// conversion rewrites unitValue for display but leaves cost untouched,
// which silently corrupts the Unit Cost column (cost ends up divided by the
// converted quantity instead of the one it was actually priced against).
const toPlainStockRow = (record) => (record?.toJSON ? record.toJSON() : { ...record });

// Latest purchase cost (falling back to the flat Item Stock unit cost)
// per itemId, so a Factory Stock row still shows a reference unit cost after
// its own running `cost` has gone to 0 (quantity fully consumed).
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

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureStockSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      createdAt: { [Op.between]: [start, end] },
    });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count, totalQuantity, totalBalance] = await Promise.all([
    ManufactureStock.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    ManufactureStock.count({ where: whereConditions }),
    ManufactureStock.sum("unitValue", { where: whereConditions }),
    ManufactureStock.sum("cost", { where: whereConditions }),
  ]);

  return {
    meta: {
      count,
      page,
      limit,
      totalQuantity: totalQuantity || 0,
      totalBalance: Number(totalBalance || 0),
    },
    data: await attachLastUnitCost(data.map(toPlainStockRow)),
  };
};

const getDataById = async (id) => {
  const data = await ManufactureStock.findAll({
    where: { productId: id },
  });

  return attachLastUnitCost(data.map(toPlainStockRow));
};

const getAllFromDBWithoutQuery = async () => {
  const data = await ManufactureStock.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return attachLastUnitCost(data.map(toPlainStockRow));
};

const ManufactureStockService = {
  getAllFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ManufactureStockService;

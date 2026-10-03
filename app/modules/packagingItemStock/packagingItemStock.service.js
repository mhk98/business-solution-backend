const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
} = require("../../../helpers/unitConversionHelper");
const {
  isAverageCostLive,
  lastAverageByStockRow,
} = require("../../../shared/averageCostRunner");
const db = require("../../../models");
const {
  PackagingItemStockSearchableFields,
} = require("./packagingItemStock.constants");
const {
  lastKnownUnitCostMap,
  lastReceivedDateMap,
} = require("../../../shared/packagingFifoCostLayers");

const PackagingItemStock = db.packagingItemStock;

const averageOfRow = (row) => {
  const quantity = toBaseStockPayload(row.unit, row.unitValue).unitValue;
  return quantity > 0 ? Number(row.cost || 0) / quantity : null;
};

const attachLastUnitCost = async (rows) => {
  if (!rows.length) return rows;
  const averageLive = await isAverageCostLive();
  const [lastUnitCostMap, receivedDateMap, lastAverage] = await Promise.all([
    lastKnownUnitCostMap(rows.map((r) => r.packagingItemId)),
    lastReceivedDateMap(rows.map((r) => r.packagingItemId)),
    averageLive
      ? lastAverageByStockRow("PackagingItemStock", rows.map((r) => r.Id))
      : new Map(),
  ]);
  return rows.map((row) => ({
    ...row,
    // After weighted-average go-live: the row's average (cost ÷ quantity);
    // an empty row keeps its last average rather than dropping to ৳0.
    lastUnitCost: averageLive && averageOfRow(row) != null
      ? averageOfRow(row)
      : lastAverage.get(Number(row.Id)) ||
        lastUnitCostMap.get(Number(row.packagingItemId)) || 0,
    lastReceivedDate:
      receivedDateMap.get(Number(row.packagingItemId)) || null,
  }));
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingItemStockSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => ({
          [key]: { [Op.eq]: value },
        })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({ createdAt: { [Op.between]: [start, end] } });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count, totalQuantity] = await Promise.all([
    PackagingItemStock.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingItemStock.count({ where: whereConditions }),
    PackagingItemStock.sum("unitValue", { where: whereConditions }),
  ]);

  return {
    meta: { count, page, limit, totalQuantity: totalQuantity || 0 },
    data: await attachLastUnitCost(data.map(formatStockForDisplay)),
  };
};

const getDataById = async (id) => {
  const data = await PackagingItemStock.findAll({
    where: { packagingItemId: id },
  });
  return attachLastUnitCost(data.map(formatStockForDisplay));
};

const getAllFromDBWithoutQuery = async () => {
  const data = await PackagingItemStock.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return attachLastUnitCost(data.map(formatStockForDisplay));
};

module.exports = {
  getAllFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

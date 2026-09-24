const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { parseMetadata } = require("../../../shared/stockReportBalances");
const {
  StockMovementSearchableFields,
} = require("./stockMovement.constants");

const StockMovement = db.stockMovement;

// After a history rebuild, rows up to the HISTORY_REBUILD control row's
// `supersedesThroughId` are replaced by the rebuilt rows (kept only for
// FIFO cost look-ups) — list only the effective ledger, like the reports do
// (see shared/stockReportBalances.effectiveLedgerRows).
const effectiveLedgerCondition = async () => {
  const control = await StockMovement.findOne({
    where: { operation: "HISTORY_REBUILD" },
    order: [["Id", "DESC"]],
    raw: true,
  });
  const cutoff = Number(parseMetadata(control?.metadata).supersedesThroughId || 0);
  return {
    operation: { [Op.ne]: "HISTORY_REBUILD" },
    ...(cutoff ? { Id: { [Op.gt]: cutoff } } : {}),
  };
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: StockMovementSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (key === "stockType") {
        const types = String(value).split(",").filter(Boolean);
        if (types.includes("ItemStock")) types.push("PackagingStock");
        andConditions.push({ stockType: { [Op.in]: types } });
      } else {
        andConditions.push({ [key]: { [Op.eq]: value } });
      }
    }
  });

  if (startDate || endDate) {
    const date = {};
    if (startDate) date[Op.gte] = String(startDate).slice(0, 10);
    if (endDate) date[Op.lte] = String(endDate).slice(0, 10);
    andConditions.push({ date });
  }

  andConditions.push(await effectiveLedgerCondition());
  const whereConditions = { [Op.and]: andConditions };

  const [data, count] = await Promise.all([
    StockMovement.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"], ["createdAt", "DESC"], ["Id", "DESC"]],
    }),
    StockMovement.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data,
  };
};

const getDataById = async (id) => {
  return StockMovement.findOne({ where: { Id: id } });
};

// Distinct item/product names that have actually appeared in the movement
// log — spans every stockType (ItemStock, FactoryStock, ProductStock,
// PackagingStock) since `name` is denormalized onto every row, unlike
// productId/itemId which are separate, only-sometimes-populated id spaces.
const getDistinctNames = async () => {
  const rows = await StockMovement.findAll({
    attributes: [
      [db.Sequelize.fn("DISTINCT", db.Sequelize.col("name")), "name"],
    ],
    where: { name: { [Op.ne]: null } },
    order: [["name", "ASC"]],
    raw: true,
  });

  return rows.map((row) => row.name).filter(Boolean);
};

module.exports = {
  getAllFromDB,
  getDataById,
  getDistinctNames,
};

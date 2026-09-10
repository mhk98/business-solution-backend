const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const ensureUniqueName = require("../../../shared/ensureUniqueName");

const DollarSupplier = db.dollarSupplier;
const DollarSupplierHistory = db.dollarSupplierHistory;

// A dollar supplier's balance is one running number: total paid minus total
// owed (gross due). Every DollarSupplierHistory row is either "Paid" or
// "Unpaid" — never both. A positive net balance is an advance; a negative one
// is due. Mirrors app/modules/supplier/supplier.service.js.
const getHistoryDateWhere = ({ startDate, endDate } = {}) => {
  for (const value of [startDate, endDate]) {
    if (!value) continue;
    const parsed = new Date(value);
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new ApiError(400, "Dates must be valid YYYY-MM-DD values");
    }
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ApiError(400, "Start date must be on or before end date");
  }
  if (!startDate && !endDate) return {};
  return {
    date: {
      ...(startDate ? { [Op.gte]: startDate } : {}),
      ...(endDate ? { [Op.lte]: endDate } : {}),
    },
  };
};

const getBalanceMap = async (dollarSupplierIds, dateWhere = {}) => {
  const balanceRows = await DollarSupplierHistory.findAll({
    attributes: [
      "dollarSupplierId",
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal("CASE WHEN status = 'Paid' THEN amount ELSE 0 END"),
        ),
        "totalPaid",
      ],
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal(
            "CASE WHEN status = 'Unpaid' THEN amount ELSE 0 END",
          ),
        ),
        "grossDue",
      ],
    ],
    where: {
      dollarSupplierId: { [Op.in]: dollarSupplierIds },
      ...dateWhere,
    },
    group: ["dollarSupplierId"],
    raw: true,
  });

  return balanceRows.reduce((acc, row) => {
    acc[row.dollarSupplierId] = {
      totalPaid: Number(row.totalPaid || 0),
      grossDue: Number(row.grossDue || 0),
    };
    return acc;
  }, {});
};

const addBalancesToDollarSuppliers = async (dollarSuppliers, dateWhere = {}) => {
  const plain = dollarSuppliers.map((supplier) =>
    supplier.get ? supplier.get({ plain: true }) : supplier,
  );
  const ids = plain.map((supplier) => supplier.Id);

  if (!ids.length) {
    return plain;
  }

  const balanceMap = await getBalanceMap(ids, dateWhere);

  return plain.map((supplier) => {
    const balance = balanceMap[supplier.Id] || {};
    const totalPaid = Number(balance.totalPaid || 0);
    const grossDue = Number(balance.grossDue || 0);
    const netBalance = totalPaid - grossDue;
    const totalAdvance = Math.max(netBalance, 0);
    const totalUnpaid = Math.max(-netBalance, 0);

    return {
      ...supplier,
      totalPaid,
      totalAdvance,
      totalUnpaid,
      totalDue: totalUnpaid,
      grossDue,
      netBalance: totalAdvance,
    };
  });
};

const insertIntoDB = async (data) => {
  await ensureUniqueName(DollarSupplier, data.name, { label: "Dollar Supplier" });

  return DollarSupplier.create(data);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...filterData } = filters;
  const dateWhere = getHistoryDateWhere({ startDate, endDate });

  const andConditions = [];

  if (searchTerm) {
    andConditions.push({ name: { [Op.like]: `${searchTerm}%` } });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      [Op.and]: Object.entries(filterData).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await DollarSupplier.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await DollarSupplier.count({ where: whereConditions });
  const data = await addBalancesToDollarSuppliers(result, dateWhere);

  return {
    meta: { count, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  return DollarSupplier.findOne({ where: { Id: id } });
};

const deleteIdFromDB = async (id) => {
  return DollarSupplier.destroy({ where: { Id: id } });
};

const updateOneFromDB = async (id, payload) => {
  await ensureUniqueName(DollarSupplier, payload.name, {
    excludeId: id,
    label: "Dollar Supplier",
  });

  return DollarSupplier.update(payload, { where: { Id: id } });
};

const getAllFromDBWithoutQuery = async (filters = {}) => {
  const dateWhere = getHistoryDateWhere(filters);
  const result = await DollarSupplier.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return addBalancesToDollarSuppliers(result, dateWhere);
};

const DollarSupplierService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DollarSupplierService;

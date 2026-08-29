const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { ManufacturerSearchableFields } = require("./manufacturer.constants");
const ApiError = require("../../../error/ApiError");

const Manufacturer = db.manufacturer;
const ManufacturerTransaction = db.manufacturerTransaction;

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

// A manufacturer's balance is one running number: total paid (credit) minus
// total wage owed (debit). A positive net balance is an advance (they've been
// overpaid); a negative one is due. Paid stays a separate lifetime total for
// display — it doesn't take part in the netting.
const getManufacturerAmountMap = async (manufacturerIds = []) => {
  const ids = manufacturerIds.map(Number).filter(Boolean);
  if (!ids.length) return new Map();

  const transactionRows = await ManufacturerTransaction.findAll({
    where: { manufacturerId: { [Op.in]: ids } },
    attributes: [
      "manufacturerId",
      [db.sequelize.fn("SUM", db.sequelize.col("debit")), "totalDebit"],
      [db.sequelize.fn("SUM", db.sequelize.col("credit")), "totalCredit"],
    ],
    group: ["manufacturerId"],
    raw: true,
  });

  return new Map(
    transactionRows.map((row) => {
      const totalDebit = toNumber(row.totalDebit);
      const totalCredit = toNumber(row.totalCredit);
      const netBalance = totalCredit - totalDebit;

      return [
        Number(row.manufacturerId),
        {
          totalDebit,
          totalCredit,
          paidAmount: totalCredit,
          totalAdvance: Math.max(netBalance, 0),
          totalDue: Math.max(-netBalance, 0),
          unpaidAmount: Math.max(-netBalance, 0),
        },
      ];
    }),
  );
};

const attachUnpaidAmounts = async (rows = []) => {
  const amountMap = await getManufacturerAmountMap(rows.map((row) => row.Id));

  return rows.map((row) => {
    const summary = amountMap.get(Number(row.Id)) || {};
    const paidAmount = summary.paidAmount || 0;
    const totalAdvance = summary.totalAdvance || 0;
    const totalDue = summary.totalDue || 0;
    const unpaidAmount = totalDue;
    if (typeof row.setDataValue === "function") {
      row.setDataValue("paidAmount", paidAmount);
      row.setDataValue("totalAdvance", totalAdvance);
      row.setDataValue("totalDue", totalDue);
      row.setDataValue("unpaidAmount", unpaidAmount);
      return row;
    }
    return { ...row, paidAmount, totalAdvance, totalDue, unpaidAmount };
  });
};

const insertIntoDB = async (data) => {
  return Manufacturer.create({
    name: data.name,
    phone: data.phone || null,
    address: data.address || null,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      [Op.or]: ManufacturerSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value) {
      andConditions.push({
        [key]: { [Op.like]: `%${String(value).trim()}%` },
      });
    }
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const dataRows = await Manufacturer.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Manufacturer.count({ where: whereConditions });
  const data = await attachUnpaidAmounts(dataRows);

  return {
    meta: { count, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  const row = await Manufacturer.findOne({
    where: { Id: id },
  });
  if (!row) return row;
  const [data] = await attachUnpaidAmounts([row]);
  return data;
};

const deleteIdFromDB = async (id) => {
  return Manufacturer.destroy({
    where: { Id: id },
  });
};

const updateOneFromDB = async (id, payload) => {
  return Manufacturer.update(
    {
      name: payload.name,
      phone: payload.phone || null,
      address: payload.address || null,
    },
    {
      where: { Id: id },
    },
  );
};

const getAllFromDBWithoutQuery = async () => {
  const rows = await Manufacturer.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return attachUnpaidAmounts(rows);
};

const getTransactionHistory = async (id, options = {}) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const manufacturer = await Manufacturer.findOne({ where: { Id: id } });
  if (!manufacturer) throw new ApiError(404, "Manufacturer not found");

  const where = { manufacturerId: Number(id) };
  const [data, count, summaryRows] = await Promise.all([
    ManufacturerTransaction.findAll({
      where,
      offset: skip,
      limit,
      order: [["createdAt", "DESC"]],
      paranoid: true,
    }),
    ManufacturerTransaction.count({ where }),
    ManufacturerTransaction.findAll({
      where,
      attributes: [
        [db.sequelize.fn("SUM", db.sequelize.col("debit")), "totalDebit"],
        [db.sequelize.fn("SUM", db.sequelize.col("credit")), "totalCredit"],
      ],
      raw: true,
    }),
  ]);

  const summary = summaryRows?.[0] || {};
  const totalDebit = toNumber(summary.totalDebit);
  const totalCredit = toNumber(summary.totalCredit);
  const netBalance = totalCredit - totalDebit;

  return {
    meta: { count, page, limit },
    manufacturer,
    summary: {
      totalDebit,
      totalCredit,
      paidAmount: totalCredit,
      totalAdvance: Math.max(netBalance, 0),
      totalDue: Math.max(-netBalance, 0),
      unpaidAmount: Math.max(-netBalance, 0),
    },
    data,
  };
};

const ManufacturerService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getTransactionHistory,
};

module.exports = ManufacturerService;

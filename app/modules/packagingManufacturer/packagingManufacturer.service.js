const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  PackagingManufacturerSearchableFields,
} = require("./packagingManufacturer.constants");

const PackagingManufacturer = db.packagingManufacturer;
const PackagingManufacturerTransaction = db.packagingManufacturerTransaction;

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

// A packaging manufacturer's balance is one running number: total paid
// (credit) minus total wage owed (debit). A positive net balance is an
// advance (they've been overpaid); a negative one is due. Paid stays a
// separate lifetime total for display — it doesn't take part in the netting.
// Mirrors manufacturer.service.js's getManufacturerAmountMap.
const getManufacturerAmountMap = async (manufacturerIds = []) => {
  const ids = manufacturerIds.map(Number).filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await PackagingManufacturerTransaction.findAll({
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
    rows.map((row) => {
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

const insertIntoDB = async (data) =>
  PackagingManufacturer.create({
    name: data.name,
    phone: data.phone || null,
    address: data.address || null,
  });

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      [Op.or]: PackagingManufacturerSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value) {
      andConditions.push({ [key]: { [Op.like]: `%${String(value).trim()}%` } });
    }
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};
  const [dataRows, count] = await Promise.all([
    PackagingManufacturer.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingManufacturer.count({ where: whereConditions }),
  ]);
  const data = await attachUnpaidAmounts(dataRows);

  return { meta: { count, page, limit }, data };
};

const getDataById = async (id) => {
  const row = await PackagingManufacturer.findOne({ where: { Id: id } });
  if (!row) return row;
  const [data] = await attachUnpaidAmounts([row]);
  return data;
};

const deleteIdFromDB = async (id) =>
  PackagingManufacturer.destroy({ where: { Id: id } });

const updateOneFromDB = async (id, payload) =>
  PackagingManufacturer.update(
    {
      name: payload.name,
      phone: payload.phone || null,
      address: payload.address || null,
    },
    { where: { Id: id } },
  );

const getAllFromDBWithoutQuery = async () =>
  attachUnpaidAmounts(await PackagingManufacturer.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  }));

const payManufacturerAmount = async (id, payload = {}) => {
  const manufacturer = await PackagingManufacturer.findOne({ where: { Id: id } });
  if (!manufacturer) throw new ApiError(404, "Packaging manufacturer not found");

  const amount = toNumber(payload.amount);
  if (amount <= 0) throw new ApiError(400, "Please enter valid paid amount");

  return PackagingManufacturerTransaction.create({
    manufacturerId: manufacturer.Id,
    manufacturerName: manufacturer.name,
    mixerId: null,
    type: "PAYMENT",
    description: payload.description || "Packaging manufacturer wage payment",
    debit: 0,
    credit: amount,
    date: payload.date || new Date().toISOString().slice(0, 10),
    note: payload.note || null,
  });
};

// Packaging manufacturers the company has overpaid as of `to` — i.e. ones
// who still owe the company wage work/refund. Point-in-time snapshot
// filtered to PackagingManufacturerTransaction rows on or before `to`, for
// the shared "All Books" / dashboard statement report. Mirrors
// manufacturer.service.js's getManufacturerReceivableReport.
const getPackagingManufacturerReceivableReport = async ({ to } = {}) => {
  const dateWhere = to ? { date: { [Op.lte]: to } } : {};

  const balanceRows = await PackagingManufacturerTransaction.findAll({
    attributes: [
      "manufacturerId",
      [db.sequelize.fn("SUM", db.sequelize.col("debit")), "totalDebit"],
      [db.sequelize.fn("SUM", db.sequelize.col("credit")), "totalCredit"],
    ],
    where: dateWhere,
    group: ["manufacturerId"],
    raw: true,
  });

  const manufacturerIds = balanceRows
    .map((row) => row.manufacturerId)
    .filter(Boolean);
  const manufacturers = manufacturerIds.length
    ? await PackagingManufacturer.findAll({
        where: { Id: { [Op.in]: manufacturerIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(manufacturers.map((m) => [m.Id, m.name]));

  const data = balanceRows
    .map((row) => {
      const totalDebit = toNumber(row.totalDebit);
      const totalCredit = toNumber(row.totalCredit);
      const advance = Math.max(totalCredit - totalDebit, 0);

      return {
        manufacturerId: row.manufacturerId,
        name: nameById.get(row.manufacturerId) || null,
        advance,
      };
    })
    // Skip deleted/unknown manufacturers — only live ones the company has
    // overpaid belong here.
    .filter((row) => row.name && row.advance > 0)
    .sort((a, b) => b.advance - a.advance);

  const totalAdvance = data.reduce((sum, row) => sum + row.advance, 0);

  return {
    meta: { to: to || null, count: data.length, totalAdvance },
    data,
  };
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  payManufacturerAmount,
  getPackagingManufacturerReceivableReport,
};

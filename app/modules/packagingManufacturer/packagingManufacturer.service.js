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

// Same validation/shape as supplier.service.js's getHistoryDateWhere and
// manufacturer.service.js's getTransactionDateWhere — a plain `date` range
// filter for PackagingManufacturerTransaction rows.
const getTransactionDateWhere = ({ startDate, endDate } = {}) => {
  for (const value of [startDate, endDate]) {
    if (!value) continue;
    const parsed = new Date(value);
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new ApiError(400, "Dates must be valid YYYY-MM-DD values");
    }
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ApiError(400, "Start date must be on or before end date");
  }
  if (!startDate && !endDate) return {};
  return { date: {
    ...(startDate ? { [Op.gte]: startDate } : {}),
    ...(endDate ? { [Op.lte]: endDate } : {}),
  } };
};

// A packaging manufacturer's balance is one running number: total paid
// (credit) minus total wage owed (debit). A positive net balance is an
// advance (they've been overpaid); a negative one is due. Paid stays a
// separate lifetime total for display — it doesn't take part in the netting.
// Mirrors manufacturer.service.js's getManufacturerAmountMap. `dateWhere`
// scopes this to a date range (e.g. the list page's date filter) instead of
// all-time.
const getManufacturerAmountMap = async (manufacturerIds = [], dateWhere = {}) => {
  const ids = manufacturerIds.map(Number).filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await PackagingManufacturerTransaction.findAll({
    where: { manufacturerId: { [Op.in]: ids }, ...dateWhere },
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

const attachUnpaidAmounts = async (rows = [], dateWhere = {}) => {
  const amountMap = await getManufacturerAmountMap(
    rows.map((row) => row.Id),
    dateWhere,
  );
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
  const { searchTerm, startDate, endDate, ...filterData } = filters;
  const dateWhere = getTransactionDateWhere({ startDate, endDate });
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
  const data = await attachUnpaidAmounts(dataRows, dateWhere);

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

const getAllFromDBWithoutQuery = async (filters = {}) => {
  const dateWhere = getTransactionDateWhere(filters);
  const rows = await PackagingManufacturer.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return attachUnpaidAmounts(rows, dateWhere);
};

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

// Packaging manufacturers the company has overpaid — i.e. ones who still owe
// the company wage work/refund. For the shared "All Books" / dashboard
// statement report. `advance` is the closing (through the selected end date) overpayment;
// `openingBalance` / `endingBalance` are the same figure as of `< from` and
// `<= to`. Mirrors manufacturer.service.js's getManufacturerReceivableReport.
const getPackagingManufacturerReceivableReport = async ({ from, to } = {}) => {
  const advanceByManufacturer = async (dateWhere) => {
    const rows = await PackagingManufacturerTransaction.findAll({
      attributes: [
        "manufacturerId",
        [db.sequelize.fn("SUM", db.sequelize.col("debit")), "totalDebit"],
        [db.sequelize.fn("SUM", db.sequelize.col("credit")), "totalCredit"],
      ],
      where: dateWhere,
      group: ["manufacturerId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.manufacturerId) return;
      const advance = Math.max(
        toNumber(row.totalCredit) - toNumber(row.totalDebit),
        0,
      );
      map.set(row.manufacturerId, advance);
    });
    return map;
  };

  const [openingMap, endingMap] = await Promise.all([
    from
      ? advanceByManufacturer({ date: { [Op.lt]: from } })
      : Promise.resolve(new Map()),
    to
      ? advanceByManufacturer({ date: { [Op.lte]: to } })
      : advanceByManufacturer({}),
  ]);

  const manufacturerIds = [
    ...new Set([
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const manufacturers = manufacturerIds.length
    ? await PackagingManufacturer.findAll({
        where: { Id: { [Op.in]: manufacturerIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(manufacturers.map((m) => [m.Id, m.name]));

  const data = manufacturerIds
    .map((manufacturerId) => ({
      manufacturerId,
      name: nameById.get(manufacturerId) || null,
      advance: endingMap.get(manufacturerId) || 0,
      openingBalance: openingMap.get(manufacturerId) || 0,
      endingBalance: endingMap.get(manufacturerId) || 0,
    }))
    // Skip deleted/unknown manufacturers — only live ones the company has
    // overpaid (at closing or during the period) belong here.
    .filter(
      (row) =>
        row.name &&
        (row.advance > 0 || row.openingBalance > 0 || row.endingBalance > 0),
    )
    .sort((a, b) => b.advance - a.advance);

  const sum = (key) => data.reduce((acc, row) => acc + row[key], 0);

  return {
    meta: {
      from: from || null,
      to: to || null,
      count: data.length,
      totalAdvance: sum("advance"),
      totalOpeningBalance: sum("openingBalance"),
      totalEndingBalance: sum("endingBalance"),
    },
    data,
  };
};

// Packaging manufacturers the company still owes — the mirror of
// getPackagingManufacturerReceivableReport. `due` is the closing (through the
// selected end date) figure; `openingBalance` / `endingBalance` are the same
// as of `< from` and `<= to`. Mirrors manufacturer.service.js's
// getManufacturerDueReport.
const getPackagingManufacturerDueReport = async ({ from, to } = {}) => {
  const dueByManufacturer = async (dateWhere) => {
    const rows = await PackagingManufacturerTransaction.findAll({
      attributes: [
        "manufacturerId",
        [db.sequelize.fn("SUM", db.sequelize.col("debit")), "totalDebit"],
        [db.sequelize.fn("SUM", db.sequelize.col("credit")), "totalCredit"],
      ],
      where: dateWhere,
      group: ["manufacturerId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.manufacturerId) return;
      const due = Math.max(
        toNumber(row.totalDebit) - toNumber(row.totalCredit),
        0,
      );
      map.set(row.manufacturerId, due);
    });
    return map;
  };

  const [openingMap, endingMap] = await Promise.all([
    from
      ? dueByManufacturer({ date: { [Op.lt]: from } })
      : Promise.resolve(new Map()),
    to ? dueByManufacturer({ date: { [Op.lte]: to } }) : dueByManufacturer({}),
  ]);

  const manufacturerIds = [
    ...new Set([
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const manufacturers = manufacturerIds.length
    ? await PackagingManufacturer.findAll({
        where: { Id: { [Op.in]: manufacturerIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(manufacturers.map((m) => [m.Id, m.name]));

  const data = manufacturerIds
    .map((manufacturerId) => ({
      manufacturerId,
      name: nameById.get(manufacturerId) || null,
      due: endingMap.get(manufacturerId) || 0,
      openingBalance: openingMap.get(manufacturerId) || 0,
      endingBalance: endingMap.get(manufacturerId) || 0,
    }))
    // Skip deleted/unknown manufacturers — only live ones with an outstanding
    // due (at closing or during the period) belong here.
    .filter(
      (row) =>
        row.name &&
        (row.due > 0 || row.openingBalance > 0 || row.endingBalance > 0),
    )
    .sort((a, b) => b.due - a.due);

  const sum = (key) => data.reduce((acc, row) => acc + row[key], 0);

  return {
    meta: {
      from: from || null,
      to: to || null,
      count: data.length,
      totalDue: sum("due"),
      totalOpeningBalance: sum("openingBalance"),
      totalEndingBalance: sum("endingBalance"),
    },
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
  getPackagingManufacturerDueReport,
};

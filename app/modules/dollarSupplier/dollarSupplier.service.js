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

// Dollar suppliers the company has overpaid (advance beyond what's owed) —
// exact mirror of supplier.service.js's getSupplierReceivableReport, so the
// All Books report can show a matching "কোম্পানি পাবে (ডলার সাপ্লাইয়ার)"
// section. `advance` is the current (unfiltered) figure; `openingBalance` /
// `endingBalance` are the same as of `< from` / `<= to` for the period move.
const getDollarSupplierReceivableReport = async ({ from, to } = {}) => {
  const advanceByDollarSupplier = async (dateWhere) => {
    const rows = await DollarSupplierHistory.findAll({
      attributes: [
        "dollarSupplierId",
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(
              "CASE WHEN status = 'Paid' THEN amount ELSE 0 END",
            ),
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
      where: dateWhere,
      group: ["dollarSupplierId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.dollarSupplierId) return;
      const advance = Math.max(
        Number(row.totalPaid || 0) - Number(row.grossDue || 0),
        0,
      );
      map.set(row.dollarSupplierId, advance);
    });
    return map;
  };

  const [currentMap, openingMap, endingMap] = await Promise.all([
    advanceByDollarSupplier({}),
    from
      ? advanceByDollarSupplier({ date: { [Op.lt]: from } })
      : Promise.resolve(new Map()),
    to
      ? advanceByDollarSupplier({ date: { [Op.lte]: to } })
      : advanceByDollarSupplier({}),
  ]);

  const dollarSupplierIds = [
    ...new Set([
      ...currentMap.keys(),
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const dollarSuppliers = dollarSupplierIds.length
    ? await DollarSupplier.findAll({
        where: { Id: { [Op.in]: dollarSupplierIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(dollarSuppliers.map((s) => [s.Id, s.name]));

  const data = dollarSupplierIds
    .map((dollarSupplierId) => ({
      dollarSupplierId,
      name: nameById.get(dollarSupplierId) || null,
      advance: currentMap.get(dollarSupplierId) || 0,
      openingBalance: openingMap.get(dollarSupplierId) || 0,
      endingBalance: endingMap.get(dollarSupplierId) || 0,
    }))
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

// Dollar suppliers the company still owes (gross due beyond what's been
// paid) — the mirror of getDollarSupplierReceivableReport, matching
// supplier.service.js's getSupplierDueReport. `due` is the current
// (unfiltered) figure; `openingBalance` / `endingBalance` are the same as of
// `< from` / `<= to` so the PDF can show the period movement.
const getDollarSupplierDueReport = async ({ from, to } = {}) => {
  const dueByDollarSupplier = async (dateWhere) => {
    const rows = await DollarSupplierHistory.findAll({
      attributes: [
        "dollarSupplierId",
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(
              "CASE WHEN status = 'Paid' THEN amount ELSE 0 END",
            ),
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
      where: dateWhere,
      group: ["dollarSupplierId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.dollarSupplierId) return;
      const due = Math.max(
        Number(row.grossDue || 0) - Number(row.totalPaid || 0),
        0,
      );
      map.set(row.dollarSupplierId, due);
    });
    return map;
  };

  const [currentMap, openingMap, endingMap] = await Promise.all([
    dueByDollarSupplier({}),
    from
      ? dueByDollarSupplier({ date: { [Op.lt]: from } })
      : Promise.resolve(new Map()),
    to ? dueByDollarSupplier({ date: { [Op.lte]: to } }) : dueByDollarSupplier({}),
  ]);

  const dollarSupplierIds = [
    ...new Set([
      ...currentMap.keys(),
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const dollarSuppliers = dollarSupplierIds.length
    ? await DollarSupplier.findAll({
        where: { Id: { [Op.in]: dollarSupplierIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(dollarSuppliers.map((s) => [s.Id, s.name]));

  const data = dollarSupplierIds
    .map((dollarSupplierId) => ({
      dollarSupplierId,
      name: nameById.get(dollarSupplierId) || null,
      due: currentMap.get(dollarSupplierId) || 0,
      openingBalance: openingMap.get(dollarSupplierId) || 0,
      endingBalance: endingMap.get(dollarSupplierId) || 0,
    }))
    .filter(
      (row) =>
        row.name &&
        (row.due > 0 || row.openingBalance > 0 || row.endingBalance > 0),
    )
    .sort((a, b) => b.due - a.due);

  const sumDue = (key) => data.reduce((acc, row) => acc + row[key], 0);

  return {
    meta: {
      from: from || null,
      to: to || null,
      count: data.length,
      totalDue: sumDue("due"),
      totalOpeningBalance: sumDue("openingBalance"),
      totalEndingBalance: sumDue("endingBalance"),
    },
    data,
  };
};

const DollarSupplierService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getDollarSupplierReceivableReport,
  getDollarSupplierDueReport,
};

module.exports = DollarSupplierService;

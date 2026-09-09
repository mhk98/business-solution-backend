const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const ensureUniqueName = require("../../../shared/ensureUniqueName");
const { SupplierSearchableFields } = require("./supplier.constants");
const Supplier = db.supplier;
const SupplierHistory = db.supplierHistory;

// A supplier's balance is one running number: total paid minus total owed
// (gross due). Every SupplierHistory row is either "Paid" or "Unpaid" — never
// both — so this is a plain aggregate, not a per-row guess. A positive net
// balance is an advance (they've been overpaid); a negative one is due.
const getHistoryDateWhere = ({ startDate, endDate } = {}) => {
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

const getBalanceMap = async (supplierIds, dateWhere = {}) => {
  const balanceRows = await SupplierHistory.findAll({
    attributes: [
      "supplierId",
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
    where: {
      supplierId: { [Op.in]: supplierIds },
      ...dateWhere,
    },
    group: ["supplierId"],
    raw: true,
  });

  return balanceRows.reduce((acc, row) => {
    acc[row.supplierId] = {
      totalPaid: Number(row.totalPaid || 0),
      grossDue: Number(row.grossDue || 0),
    };
    return acc;
  }, {});
};

const addBalancesToSuppliers = async (suppliers, dateWhere = {}) => {
  const plainSuppliers = suppliers.map((supplier) =>
    supplier.get ? supplier.get({ plain: true }) : supplier,
  );
  const supplierIds = plainSuppliers.map((supplier) => supplier.Id);

  if (!supplierIds.length) {
    return plainSuppliers;
  }

  const balanceMap = await getBalanceMap(supplierIds, dateWhere);

  return plainSuppliers.map((supplier) => {
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

// Suppliers the company has overpaid — i.e. suppliers who still owe the company
// goods/refund (mirrors addBalancesToSuppliers' netBalance logic). For the
// shared "All Books" / dashboard statement report. `advance` is the current
// (unfiltered) overpayment; `openingBalance` / `endingBalance` are the same
// figure as of `< from` and `<= to` so the PDF can show the period movement.
const getSupplierReceivableReport = async ({ from, to } = {}) => {
  const advanceBySupplier = async (dateWhere) => {
    const rows = await SupplierHistory.findAll({
      attributes: [
        "supplierId",
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
      group: ["supplierId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.supplierId) return;
      const advance = Math.max(
        Number(row.totalPaid || 0) - Number(row.grossDue || 0),
        0,
      );
      map.set(row.supplierId, advance);
    });
    return map;
  };

  const [currentMap, openingMap, endingMap] = await Promise.all([
    advanceBySupplier({}),
    from
      ? advanceBySupplier({ date: { [Op.lt]: from } })
      : Promise.resolve(new Map()),
    to ? advanceBySupplier({ date: { [Op.lte]: to } }) : advanceBySupplier({}),
  ]);

  const supplierIds = [
    ...new Set([
      ...currentMap.keys(),
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const suppliers = supplierIds.length
    ? await Supplier.findAll({
        where: { Id: { [Op.in]: supplierIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(suppliers.map((s) => [s.Id, s.name]));

  const data = supplierIds
    .map((supplierId) => ({
      supplierId,
      name: nameById.get(supplierId) || null,
      advance: currentMap.get(supplierId) || 0,
      openingBalance: openingMap.get(supplierId) || 0,
      endingBalance: endingMap.get(supplierId) || 0,
    }))
    // Skip deleted/unknown suppliers — this report only lists live suppliers
    // the company has actually overpaid (now or during the period).
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

// Suppliers the company still owes (gross due beyond what's been paid) — the
// mirror of getSupplierReceivableReport. `due` is the current (unfiltered)
// figure; `openingBalance` / `endingBalance` are the same as of `< from` and
// `<= to` so the PDF can show the period movement.
const getSupplierDueReport = async ({ from, to } = {}) => {
  const dueBySupplier = async (dateWhere) => {
    const rows = await SupplierHistory.findAll({
      attributes: [
        "supplierId",
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
      group: ["supplierId"],
      raw: true,
    });
    const map = new Map();
    rows.forEach((row) => {
      if (!row.supplierId) return;
      const due = Math.max(
        Number(row.grossDue || 0) - Number(row.totalPaid || 0),
        0,
      );
      map.set(row.supplierId, due);
    });
    return map;
  };

  const [currentMap, openingMap, endingMap] = await Promise.all([
    dueBySupplier({}),
    from
      ? dueBySupplier({ date: { [Op.lt]: from } })
      : Promise.resolve(new Map()),
    to ? dueBySupplier({ date: { [Op.lte]: to } }) : dueBySupplier({}),
  ]);

  const supplierIds = [
    ...new Set([
      ...currentMap.keys(),
      ...openingMap.keys(),
      ...endingMap.keys(),
    ]),
  ];
  const suppliers = supplierIds.length
    ? await Supplier.findAll({
        where: { Id: { [Op.in]: supplierIds } },
        attributes: ["Id", "name"],
        raw: true,
      })
    : [];
  const nameById = new Map(suppliers.map((s) => [s.Id, s.name]));

  const data = supplierIds
    .map((supplierId) => ({
      supplierId,
      name: nameById.get(supplierId) || null,
      due: currentMap.get(supplierId) || 0,
      openingBalance: openingMap.get(supplierId) || 0,
      endingBalance: endingMap.get(supplierId) || 0,
    }))
    // Skip deleted/unknown suppliers — only live suppliers with an outstanding
    // due (now or during the period) belong in this report.
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

const insertIntoDB = async (data) => {
  await ensureUniqueName(Supplier, data.name, { label: "Supplier" });

  const result = await Supplier.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...filterData } = filters;
  const dateWhere = getHistoryDateWhere({ startDate, endDate });

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  // if (searchTerm && searchTerm.trim()) {
  //   andConditions.push({
  //     [Op.or]: SupplierSearchableFields.map((field) => ({
  //       [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
  //     })),
  //   });
  // }

  // // ✅ Exact filters (e.g. name)
  // if (Object.keys(otherFilters).length) {
  //   andConditions.push(
  //     ...Object.entries(otherFilters).map(([key, value]) => ({
  //       [key]: { [Op.eq]: value },
  //     }))
  //   );
  // }

  // Match `title` starting from the search term
  if (searchTerm) {
    andConditions.push({
      name: { [Op.like]: `${searchTerm}%` },
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      [Op.and]: Object.entries(filterData).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Supplier.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Supplier.count({ where: whereConditions });

  const data = await addBalancesToSuppliers(result, dateWhere);

  return {
    meta: { count, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  const result = await Supplier.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Supplier.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  await ensureUniqueName(Supplier, payload.name, {
    excludeId: id,
    label: "Supplier",
  });

  const result = await Supplier.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async (filters = {}) => {
  const dateWhere = getHistoryDateWhere(filters);
  const result = await Supplier.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return addBalancesToSuppliers(result, dateWhere);
};

const SupplierService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getSupplierReceivableReport,
  getSupplierDueReport,
};

module.exports = SupplierService;

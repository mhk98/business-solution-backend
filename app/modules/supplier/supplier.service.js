const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { SupplierSearchableFields } = require("./supplier.constants");
const Supplier = db.supplier;
const SupplierHistory = db.supplierHistory;

// A supplier's balance is one running number: total paid minus total owed
// (gross due). Every SupplierHistory row is either "Paid" or "Unpaid" — never
// both — so this is a plain aggregate, not a per-row guess. A positive net
// balance is an advance (they've been overpaid); a negative one is due.
const getBalanceMap = async (supplierIds) => {
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

const addBalancesToSuppliers = async (suppliers) => {
  const plainSuppliers = suppliers.map((supplier) =>
    supplier.get ? supplier.get({ plain: true }) : supplier,
  );
  const supplierIds = plainSuppliers.map((supplier) => supplier.Id);

  if (!supplierIds.length) {
    return plainSuppliers;
  }

  const balanceMap = await getBalanceMap(supplierIds);

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

// Suppliers the company has overpaid as of `to` — i.e. suppliers who still
// owe the company goods/refund (mirrors addBalancesToSuppliers' netBalance
// logic, but as a point-in-time snapshot filtered to SupplierHistory rows on
// or before `to`, for the shared "All Books" / dashboard statement report).
const getSupplierReceivableReport = async ({ to } = {}) => {
  const dateWhere = to ? { date: { [Op.lte]: to } } : {};

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
    where: dateWhere,
    group: ["supplierId"],
    raw: true,
  });

  const supplierIds = balanceRows
    .map((row) => row.supplierId)
    .filter(Boolean);
  const suppliers = supplierIds.length
    ? await Supplier.findAll({
        where: { Id: { [Op.in]: supplierIds } },
        attributes: ["Id", "name"],
        paranoid: false,
        raw: true,
      })
    : [];
  const nameById = new Map(suppliers.map((s) => [s.Id, s.name]));

  const data = balanceRows
    .map((row) => {
      const totalPaid = Number(row.totalPaid || 0);
      const grossDue = Number(row.grossDue || 0);
      const advance = Math.max(totalPaid - grossDue, 0);

      return {
        supplierId: row.supplierId,
        name: nameById.get(row.supplierId) || "Unknown Supplier",
        advance,
      };
    })
    .filter((row) => row.advance > 0)
    .sort((a, b) => b.advance - a.advance);

  const totalAdvance = data.reduce((sum, row) => sum + row.advance, 0);

  return {
    meta: { to: to || null, count: data.length, totalAdvance },
    data,
  };
};

const getSupplierDueReport = async () => {
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
    group: ["supplierId"],
    raw: true,
  });

  const supplierIds = balanceRows
    .map((row) => row.supplierId)
    .filter(Boolean);
  const suppliers = supplierIds.length
    ? await Supplier.findAll({
        where: { Id: { [Op.in]: supplierIds } },
        attributes: ["Id", "name"],
        paranoid: false,
        raw: true,
      })
    : [];
  const nameById = new Map(suppliers.map((s) => [s.Id, s.name]));

  const data = balanceRows
    .map((row) => {
      const totalPaid = Number(row.totalPaid || 0);
      const grossDue = Number(row.grossDue || 0);
      const due = Math.max(grossDue - totalPaid, 0);

      return {
        supplierId: row.supplierId,
        name: nameById.get(row.supplierId) || "Unknown Supplier",
        due,
      };
    })
    .filter((row) => row.due > 0)
    .sort((a, b) => b.due - a.due);

  const totalDue = data.reduce((sum, row) => sum + row.due, 0);

  return {
    meta: { count: data.length, totalDue },
    data,
  };
};

const insertIntoDB = async (data) => {
  const result = await Supplier.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, ...filterData } = filters;

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

  const data = await addBalancesToSuppliers(result);

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
  const result = await Supplier.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Supplier.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return addBalancesToSuppliers(result);
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

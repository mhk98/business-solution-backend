const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { SupplierSearchableFields } = require("./supplier.constants");
const Supplier = db.supplier;
const SupplierHistory = db.supplierHistory;
const LedgerHistory = db.ledgerHistory;
const PackagingItemPurchase = db.packagingItemPurchase;

const resolveSupplierHistoryStatus = ({ row, advanceIds, dueIds }) => {
  const id = Number(row.Id || row.id);
  const note = typeof row.note === "string" ? row.note.toLowerCase() : "";
  const hasBookReference = !!row.bookId;

  if (advanceIds.has(id)) return "Advance";
  if (
    dueIds.has(id) ||
    note.includes("packaging item purchase") ||
    note.includes("item purchase") ||
    note.includes("purchase requisition") ||
    row.status === "Unpaid"
  ) {
    return "Due";
  }
  if (hasBookReference) return "Paid";
  if (row.status === "Paid") return "Advance";

  return row.status || "Paid";
};

const getSupplierHistorySourceSets = async (historyIds) => {
  if (!historyIds.length) {
    return { advanceIds: new Set(), dueIds: new Set() };
  }

  try {
    const [ledgerRows, packagingRows] = await Promise.all([
      LedgerHistory.findAll({
        attributes: ["supplierHistoryId"],
        where: { supplierHistoryId: { [Op.in]: historyIds } },
        raw: true,
      }),
      PackagingItemPurchase.findAll({
        attributes: ["supplierHistoryId"],
        where: { supplierHistoryId: { [Op.in]: historyIds } },
        raw: true,
      }),
    ]);

    return {
      advanceIds: new Set(
        ledgerRows.map((row) => Number(row.supplierHistoryId)).filter(Boolean),
      ),
      dueIds: new Set(
        packagingRows
          .map((row) => Number(row.supplierHistoryId))
          .filter(Boolean),
      ),
    };
  } catch (error) {
    console.warn(
      "Supplier source lookup failed; falling back to status/book calculation:",
      error.message,
    );
    return { advanceIds: new Set(), dueIds: new Set() };
  }
};

const getFallbackBalanceMap = async (supplierIds) => {
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
        "totalUnpaid",
      ],
    ],
    where: {
      supplierId: { [Op.in]: supplierIds },
    },
    group: ["supplierId"],
    raw: true,
  });

  return balanceRows.reduce((acc, row) => {
    const totalPaid = Number(row.totalPaid || 0);
    const grossDue = Number(row.totalUnpaid || 0);
    const totalUnpaid = Math.max(grossDue - totalPaid, 0);

    acc[row.supplierId] = {
      totalPaid,
      totalAdvance: Math.max(totalPaid - grossDue, 0),
      totalUnpaid,
      totalDue: totalUnpaid,
      grossDue,
      netBalance: Math.max(totalPaid - grossDue, 0),
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

  let balanceMap = {};

  try {
    const historyRows = await SupplierHistory.findAll({
      attributes: ["Id", "supplierId", "amount", "status"],
      where: {
        supplierId: { [Op.in]: supplierIds },
      },
      raw: true,
    });

    const historyIds = historyRows.map((row) => Number(row.Id)).filter(Boolean);
    const { advanceIds, dueIds } =
      await getSupplierHistorySourceSets(historyIds);

    balanceMap = historyRows.reduce((acc, row) => {
      const supplierId = row.supplierId;
      const amount = Number(row.amount || 0);
      const status = resolveSupplierHistoryStatus({ row, advanceIds, dueIds });

      if (!acc[supplierId]) {
        acc[supplierId] = {
          totalPaid: 0,
          totalAdvance: 0,
          grossDue: 0,
        };
      }

      if (status === "Advance") acc[supplierId].totalAdvance += amount;
      else if (status === "Due") acc[supplierId].grossDue += amount;
      else acc[supplierId].totalPaid += amount;

      return acc;
    }, {});
  } catch (error) {
    console.warn(
      "Supplier detailed balance failed; falling back to status aggregate:",
      error.message,
    );
    balanceMap = await getFallbackBalanceMap(supplierIds);
  }

  return plainSuppliers.map((supplier) => {
    const balance = balanceMap[supplier.Id] || {};
    const totalPaid = Number(balance.totalPaid || 0);
    const totalAdvance = Number(balance.totalAdvance || 0);
    const grossDue = Number(balance.grossDue || 0);
    const totalUnpaid = Math.max(grossDue - totalPaid, 0);

    return {
      ...supplier,
      totalPaid,
      totalAdvance,
      totalUnpaid,
      totalDue: totalUnpaid,
      grossDue,
      netBalance: totalAdvance + Math.max(totalPaid - grossDue, 0),
    };
  });
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
};

module.exports = SupplierService;

const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  SupplierHistorySearchableFields,
} = require("./supplierHistory.constants");

const SupplierHistory = db.supplierHistory;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const Book = db.book;
const LedgerHistory = db.ledgerHistory;
const PackagingItemPurchase = db.packagingItemPurchase;

const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

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

const getSupplierHistorySourceSets = async (supplierHistoryIds) => {
  const ids = supplierHistoryIds.map(Number).filter(Boolean);

  if (!ids.length) {
    return { advanceIds: new Set(), dueIds: new Set() };
  }

  try {
    const [ledgerRows, packagingRows] = await Promise.all([
      LedgerHistory.findAll({
        attributes: ["supplierHistoryId"],
        where: { supplierHistoryId: { [Op.in]: ids } },
        raw: true,
      }),
      PackagingItemPurchase.findAll({
        attributes: ["supplierHistoryId"],
        where: { supplierHistoryId: { [Op.in]: ids } },
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
      "Supplier history source lookup failed; falling back to status/book calculation:",
      error.message,
    );
    return { advanceIds: new Set(), dueIds: new Set() };
  }
};

const addComputedStatus = async (rows) => {
  const plainRows = rows.map(toPlain);
  const { advanceIds, dueIds } = await getSupplierHistorySourceSets(
    plainRows.map((row) => row.Id || row.id),
  );

  return plainRows.map((row) => {
    const computedStatus = resolveSupplierHistoryStatus({
      row,
      advanceIds,
      dueIds,
    });

    return {
      ...row,
      rawStatus: row.status,
      status: computedStatus,
      displayStatus: computedStatus,
    };
  });
};

const getFallbackSummary = async (where) => {
  const [total, totalPaid, totalUnpaid] = await Promise.all([
    SupplierHistory.count({ where }),
    SupplierHistory.sum("amount", { where: { ...where, status: "Paid" } }),
    SupplierHistory.sum("amount", { where: { ...where, status: "Unpaid" } }),
  ]);

  const paid = Number(totalPaid || 0);
  const grossDue = Number(totalUnpaid || 0);

  return {
    total,
    totalPaid: paid,
    totalAdvance: Math.max(paid - grossDue, 0),
    grossDue,
    totalDue: Math.max(grossDue - paid, 0),
  };
};

const getComputedSummary = async (where) => {
  let annotatedRows = [];

  try {
    const rows = await SupplierHistory.findAll({
      attributes: ["Id", "amount", "status"],
      where,
      paranoid: true,
      raw: true,
    });
    annotatedRows = await addComputedStatus(rows);
  } catch (error) {
    console.warn(
      "Supplier history detailed summary failed; falling back to status aggregate:",
      error.message,
    );
    return getFallbackSummary(where);
  }

  const summary = annotatedRows.reduce(
    (summary, row) => {
      const amount = Number(row.amount || 0);
      summary.total += 1;

      if (row.displayStatus === "Advance") summary.totalAdvance += amount;
      else if (row.displayStatus === "Due") summary.grossDue += amount;
      else summary.totalPaid += amount;

      return summary;
    },
    { total: 0, totalPaid: 0, totalAdvance: 0, grossDue: 0 },
  );

  return {
    ...summary,
    totalDue: Math.max(summary.grossDue - summary.totalPaid, 0),
    totalAdvance:
      summary.totalAdvance + Math.max(summary.totalPaid - summary.grossDue, 0),
  };
};

const insertIntoDB = async (data) => {
  const result = await SupplierHistory.create(data);

  return result;
};

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: SupplierHistorySearchableFields.map((field) => ({
//         [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
//       })),
//     });
//   }

//   // ✅ Exact filters
//   if (Object.keys(otherFilters).length) {
//     andConditions.push(
//       ...Object.entries(otherFilters).map(([key, value]) => ({
//         [key]: { [Op.eq]: value },
//       })),
//     );
//   }

//   // ✅ Date range
//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       createdAt: { [Op.between]: [start, end] },
//     });
//   }

//   // ✅ Exclude soft deleted records
//   andConditions.push({
//     deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
//   });

//   const whereConditions = andConditions.length
//     ? { [Op.and]: andConditions }
//     : {};

//   // ✅ paginated data
//   const data = await SupplierHistory.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     include: [
//       {
//         model: Supplier,
//         as: "supplier",
//         attributes: ["Id", "name"],
//       },
//       {
//         model: Book,
//         as: "book",
//         attributes: ["Id", "name"],
//       },
//     ],
//     paranoid: true,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   const [totalPaid, totalUnpaid] = await Promise.all([
//     SupplierHistory.count({ where: whereConditions }),
//     SupplierHistory.sum("amount", {
//       where: { ...whereConditions, status: "paid" },
//     }),
//     SupplierHistory.sum("amount", {
//       where: { ...whereConditions, status: "unpaid" },
//     }),
//   ]);

//   const paid = Number(totalPaid || 0);
//   const unpaid = Number(totalUnpaid || 0);
//   const netBalance = paid - unpaid;

//   return {
//     meta: {
//       totalPaid: paid,
//       totalUnpaid: unpaid,
//       netBalance,
//       page,
//       limit,
//     },
//     data,
//   };
// };

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: SupplierHistorySearchableFields.map((field) => ({
        [field]: {
          [Op.like]: `%${searchTerm.trim()}%`, // MySQL হলে like
          // Postgres হলে Op.iLike ব্যবহার করতে পারো
        },
      })),
    });
  }

  // ✅ Exact filters
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      createdAt: {
        [Op.between]: [start, end],
      },
    });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  // ✅ paginated data
  const data = await SupplierHistory.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["Id", "name"],
      },
      {
        model: Book,
        as: "book",
        attributes: ["Id", "name"],
      },
    ],
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const [totalCount, computedSummary, annotatedData] = await Promise.all([
    SupplierHistory.count({ where: whereConditions }),
    getComputedSummary(whereConditions),
    addComputedStatus(data),
  ]);

  return {
    meta: {
      total: totalCount,
      totalPaid: computedSummary.totalPaid,
      totalAdvance: computedSummary.totalAdvance,
      totalDue: computedSummary.totalDue,
      totalUnpaid: computedSummary.totalDue,
      netBalance: computedSummary.totalAdvance,
      page,
      limit,
    },
    data: annotatedData,
  };
};
const getDataById = async (id) => {
  const result = await SupplierHistory.findAll({
    where: {
      supplierId: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await SupplierHistory.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await SupplierHistory.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await SupplierHistory.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  const [computedSummary, annotatedResult] = await Promise.all([
    getComputedSummary({}),
    addComputedStatus(result),
  ]);

  return {
    meta: {
      total: computedSummary.total,
      totalPaid: computedSummary.totalPaid,
      totalAdvance: computedSummary.totalAdvance,
      totalDue: computedSummary.totalDue,
      totalUnpaid: computedSummary.totalDue,
      netBalance: computedSummary.totalAdvance,
    },
    result: annotatedResult,
  };
};

const SupplierHistoryService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = SupplierHistoryService;

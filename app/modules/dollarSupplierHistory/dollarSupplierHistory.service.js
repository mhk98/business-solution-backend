const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const DollarSupplierHistory = db.dollarSupplierHistory;
const DollarSupplier = db.dollarSupplier;
const Book = db.book;

const toPlain = (row) => (row?.get ? row.get({ plain: true }) : row);

// A row's own status ("Paid"/"Unpaid") is authoritative. "Due" is the display
// label for "Unpaid". Mirrors supplierHistory.service.js.
const addComputedStatus = (rows) =>
  rows.map(toPlain).map((row) => {
    const computedStatus = row.status === "Paid" ? "Paid" : "Due";
    return {
      ...row,
      rawStatus: row.status,
      status: computedStatus,
      displayStatus: computedStatus,
    };
  });

const getComputedSummary = async (where) => {
  const [total, totalPaid, totalUnpaid] = await Promise.all([
    DollarSupplierHistory.count({ where }),
    DollarSupplierHistory.sum("amount", { where: { ...where, status: "Paid" } }),
    DollarSupplierHistory.sum("amount", {
      where: { ...where, status: "Unpaid" },
    }),
  ]);

  const paid = Number(totalPaid || 0);
  const grossDue = Number(totalUnpaid || 0);
  const netBalance = paid - grossDue;

  return {
    total,
    totalPaid: paid,
    totalAdvance: Math.max(netBalance, 0),
    grossDue,
    totalDue: Math.max(-netBalance, 0),
  };
};

const insertIntoDB = async (data = {}) => {
  const dollarSupplierId = Number(data.dollarSupplierId);
  const amount = Number(data.amount);

  if (!dollarSupplierId) {
    throw new ApiError(400, "dollarSupplierId is required");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const usdAmount =
    data.usdAmount !== undefined &&
    data.usdAmount !== null &&
    String(data.usdAmount).trim() !== ""
      ? Number(data.usdAmount)
      : null;
  const usdRate =
    data.usdRate !== undefined &&
    data.usdRate !== null &&
    String(data.usdRate).trim() !== ""
      ? Number(data.usdRate)
      : null;

  return DollarSupplierHistory.create({
    dollarSupplierId,
    bookId: data.bookId ? Number(data.bookId) : null,
    amount,
    usdAmount,
    usdRate,
    // Manual "Add Amount" / USD purchase entries are a due (Unpaid); Book
    // payments send "Paid".
    status: data.status === "Paid" ? "Paid" : "Unpaid",
    date: data.date ? String(data.date).slice(0, 10) : null,
    note: String(data.note || "").trim() || null,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // Filter on the transaction date (DATEONLY) for the statement view.
  if (startDate && endDate) {
    andConditions.push({
      date: { [Op.between]: [String(startDate).slice(0, 10), String(endDate).slice(0, 10)] },
    });
  } else if (startDate) {
    andConditions.push({ date: { [Op.gte]: String(startDate).slice(0, 10) } });
  } else if (endDate) {
    andConditions.push({ date: { [Op.lte]: String(endDate).slice(0, 10) } });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const data = await DollarSupplierHistory.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      { model: DollarSupplier, as: "dollarSupplier", attributes: ["Id", "name"] },
      { model: Book, as: "book", attributes: ["Id", "name"] },
    ],
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [
            ["date", "DESC"],
            ["createdAt", "DESC"],
          ],
  });

  const [totalCount, computedSummary, annotatedData] = await Promise.all([
    DollarSupplierHistory.count({ where: whereConditions }),
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
  return DollarSupplierHistory.findAll({ where: { dollarSupplierId: id } });
};

const deleteIdFromDB = async (id) => {
  return DollarSupplierHistory.destroy({ where: { Id: id } });
};

const updateOneFromDB = async (id, payload) => {
  return DollarSupplierHistory.update(payload, { where: { Id: id } });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await DollarSupplierHistory.findAll({
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

const DollarSupplierHistoryService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DollarSupplierHistoryService;

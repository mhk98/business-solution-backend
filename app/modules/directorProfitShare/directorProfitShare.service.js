const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const DirectorProfitShare = db.directorProfitShare;
const Director = db.director;
const Book = db.book;

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const normalizeAmount = (value) => {
  const numberValue = Number(value || 0);
  if (!numberValue || Number.isNaN(numberValue) || numberValue <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }
  return numberValue;
};

const normalizeType = (value) => {
  const type = String(value || "Invest").trim();
  if (!["Invest", "Profit"].includes(type)) {
    throw new ApiError(400, "Type must be Invest or Profit");
  }
  return type;
};

const ensureDirectorAndBook = async ({ directorId, bookId }, transaction) => {
  const [director, book] = await Promise.all([
    Director.findByPk(directorId, { transaction }),
    Book.findByPk(bookId, { transaction }),
  ]);

  if (!director) throw new ApiError(404, "Director not found");
  if (!book) throw new ApiError(404, "Book not found");

  return { director, book };
};

const normalizePayload = (payload, existing = {}) => ({
  directorId:
    normalizeOptionalId(payload.directorId) ||
    normalizeOptionalId(existing.directorId),
  bookId:
    normalizeOptionalId(payload.bookId) || normalizeOptionalId(existing.bookId),
  type: normalizeType(payload.type || existing.type),
  amount:
    payload.amount !== undefined
      ? normalizeAmount(payload.amount)
      : normalizeAmount(existing.amount),
  remarks: payload.remarks ?? existing.remarks ?? "",
  date:
    (payload.date && String(payload.date).slice(0, 10)) ||
    existing.date ||
    new Date().toISOString().slice(0, 10),
  status: payload.status || existing.status || "Active",
});

const insertIntoDB = async (payload) =>
  db.sequelize.transaction(async (transaction) => {
    const transactionData = normalizePayload(payload);
    await ensureDirectorAndBook(transactionData, transaction);

    return DirectorProfitShare.create(
      {
        ...transactionData,
        cashInOutId: null,
      },
      { transaction },
    );
  });

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const {
    searchTerm,
    startDate,
    endDate,
    directorId,
    bookId,
    type,
    status,
  } = filters;
  const andConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    andConditions.push({
      [Op.or]: [
        { remarks: { [Op.like]: `%${term}%` } },
        { type: { [Op.like]: `%${term}%` } },
        { "$director.name$": { [Op.like]: `%${term}%` } },
        { "$book.name$": { [Op.like]: `%${term}%` } },
        db.Sequelize.where(
          db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"),
          { [Op.like]: `%${term}%` },
        ),
      ],
    });
  }

  if (startDate && endDate) {
    andConditions.push({ date: { [Op.between]: [startDate, endDate] } });
  } else if (startDate) {
    andConditions.push({ date: { [Op.gte]: startDate } });
  } else if (endDate) {
    andConditions.push({ date: { [Op.lte]: endDate } });
  }

  if (directorId) andConditions.push({ directorId: { [Op.eq]: directorId } });
  if (bookId) andConditions.push({ bookId: { [Op.eq]: bookId } });
  if (type) andConditions.push({ type: { [Op.eq]: type } });
  if (status) andConditions.push({ status: { [Op.eq]: status } });

  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const include = [
    { model: Director, as: "director", required: false },
    { model: Book, as: "book", required: false },
  ];

  const [data, count, totalInvest, totalProfit] = await Promise.all([
    DirectorProfitShare.findAll({
      where,
      include,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"]],
    }),
    DirectorProfitShare.count({ where, include, distinct: true }),
    DirectorProfitShare.sum("amount", {
      where: { [Op.and]: [...andConditions, { type: "Invest" }] },
      include,
    }),
    DirectorProfitShare.sum("amount", {
      where: { [Op.and]: [...andConditions, { type: "Profit" }] },
      include,
    }),
  ]);

  const invest = Number(totalInvest || 0);
  const profit = Number(totalProfit || 0);

  return {
    meta: {
      count,
      page,
      limit,
      totalInvest: invest,
      totalProfit: profit,
      netBalance: invest - profit,
    },
    data,
  };
};

const getDataById = async (id) =>
  DirectorProfitShare.findOne({
    where: { Id: id },
    include: [
      { model: Director, as: "director", required: false },
      { model: Book, as: "book", required: false },
    ],
  });

const updateOneFromDB = async (id, payload) =>
  db.sequelize.transaction(async (transaction) => {
    const existing = await DirectorProfitShare.findByPk(id, { transaction });
    if (!existing) throw new ApiError(404, "Director profit share not found");

    const transactionData = normalizePayload(payload, existing);
    await ensureDirectorAndBook(transactionData, transaction);

    await existing.update(
      {
        ...transactionData,
        cashInOutId: null,
      },
      { transaction },
    );

    return existing;
  });

const deleteIdFromDB = async (id) =>
  db.sequelize.transaction(async (transaction) => {
    const existing = await DirectorProfitShare.findByPk(id, { transaction });
    if (!existing) return 0;

    return existing.destroy({ transaction });
  });

const getAllFromDBWithoutQuery = async () =>
  DirectorProfitShare.findAll({
    include: [
      { model: Director, as: "director", required: false },
      { model: Book, as: "book", required: false },
    ],
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

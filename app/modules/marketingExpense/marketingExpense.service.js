const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  MarketingExpenseSearchableFields,
} = require("./marketingExpense.constants");
const { Op } = require("sequelize");
const MarketingExpense = db.marketingExpense;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (data) => {
  const result = await MarketingExpense.create(data);
  return result;
};

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE on searchable fields)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: MarketingExpenseSearchableFields.map((field) => ({
//         [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
//       })),
//     });
//   }

//   // ✅ Exact filters (e.g. name)
//   if (Object.keys(otherFilters).length) {
//     andConditions.push(
//       ...Object.entries(otherFilters).map(([key, value]) => ({
//         [key]: { [Op.eq]: value },
//       }))
//     );
//   }

//   // ✅ Date range filter (createdAt)
//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       createdAt: { [Op.between]: [start, end] },
//     });
//   }

//   const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

//   const result = await MarketingExpense.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   const total = await MarketingExpense.count({ where: whereConditions });

//   return {
//     meta: { total, page, limit },
//     data: result,
//   };
// };

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const {
    searchTerm,
    startDate,
    endDate,
    paymentMode,
    paymentStatus,
    bookId,
    ...otherFilters
  } = filters;

  const andConditions = [];

  console.log("searchTerm", searchTerm);

  if (searchTerm) {
    andConditions.push({
      [Op.or]: MarketingExpenseSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm}%` }, // Postgres হলে Op.iLike
      })),
    });
  }

  // ✅ exact filters
  if (paymentMode) {
    andConditions.push({ paymentMode: { [Op.eq]: paymentMode } });
  }
  if (paymentStatus) {
    andConditions.push({ paymentStatus: { [Op.eq]: paymentStatus } });
  }
  if (bookId) {
    andConditions.push({ bookId: { [Op.eq]: bookId } });
  }

  // ✅ date range
  if (startDate && endDate) {
    andConditions.push({
      createdAt: {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      },
    });
  } else if (startDate) {
    andConditions.push({
      createdAt: {
        [Op.gte]: new Date(startDate),
      },
    });
  } else if (endDate) {
    andConditions.push({
      createdAt: {
        [Op.lte]: new Date(endDate),
      },
    });
  }

  // ✅ any other exact filters
  if (Object.keys(otherFilters).length) {
    Object.entries(otherFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        andConditions.push({ [key]: { [Op.eq]: value } });
      }
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const data = await MarketingExpense.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await MarketingExpense.count({ where: whereConditions });
  const [count, totalCashIn, totalCashOut] = await Promise.all([
    MarketingExpense.count({ where: whereConditions }),
    MarketingExpense.sum("amount", {
      where: { ...whereConditions, paymentStatus: "CashIn" },
    }),
    MarketingExpense.sum("amount", {
      where: { ...whereConditions, paymentStatus: "CashOut" },
    }),
  ]);

  const cashIn = Number(totalCashIn || 0);
  const cashOut = Number(totalCashOut || 0);
  const netBalance = cashIn - cashOut;

  return {
    meta: {
      count,
      totalCashIn: cashIn,
      totalCashOut: cashOut,
      netBalance,
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) => {
  const result = await MarketingExpense.findAll({
    where: {
      bookId: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await MarketingExpense.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { note, status, userId, bookId } = payload;

  const [updatedCount] = await MarketingExpense.update(payload, {
    where: {
      Id: id,
    },
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message =
    status === "Approved"
      ? "Cash In Out request approved"
      : note || "Cash In Out updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/book/${bookId}`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await MarketingExpense.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const MarketingExpenseService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = MarketingExpenseService;

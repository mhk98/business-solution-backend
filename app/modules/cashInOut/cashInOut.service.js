const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { CashInOutSearchableFields } = require("./cashInOut.constants");
const { Op } = require("sequelize");
const CashInOut = db.cashInOut;
const Notification = db.notification;
const User = db.user;
const SupplierHistory = db.supplierHistory;

const buildLoanWhere = (filters = {}, extraConditions = []) => {
  const { searchTerm, startDate, endDate, lender } = filters;
  const conditions = [
    db.Sequelize.where(db.Sequelize.fn("LOWER", db.Sequelize.col("category")), {
      [Op.eq]: "loan",
    }),
    { lender: { [Op.ne]: null } },
    { lender: { [Op.ne]: "" } },
    ...extraConditions,
  ];

  if (lender) {
    conditions.push({ lender: { [Op.eq]: lender } });
  }

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    conditions.push({
      [Op.or]: [
        { lender: { [Op.like]: `%${term}%` } },
        { remarks: { [Op.like]: `%${term}%` } },
        { paymentMode: { [Op.like]: `%${term}%` } },
        { paymentStatus: { [Op.like]: `%${term}%` } },
        db.Sequelize.where(
          db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"),
          { [Op.like]: `%${term}%` },
        ),
      ],
    });
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    conditions.push({ date: { [Op.between]: [start, end] } });
  } else if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    conditions.push({ date: { [Op.gte]: start } });
  } else if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push({ date: { [Op.lte]: end } });
  }

  return { [Op.and]: conditions };
};

const loanSumAttributes = [
  [
    db.Sequelize.fn(
      "SUM",
      db.Sequelize.literal(
        "CASE WHEN paymentStatus = 'CashIn' THEN amount ELSE 0 END",
      ),
    ),
    "totalLoanTaken",
  ],
  [
    db.Sequelize.fn(
      "SUM",
      db.Sequelize.literal(
        "CASE WHEN paymentStatus = 'CashOut' THEN amount ELSE 0 END",
      ),
    ),
    "totalLoanGiven",
  ],
];

const insertIntoDB = async (data) => {
  const { amount, date, bookId, supplierId, employeeId, file } = data;
  const hasSupplierId =
    supplierId !== undefined &&
    supplierId !== null &&
    String(supplierId) !== "";

  // const hasEmployeeId =
  //   employeeId !== undefined &&
  //   employeeId !== null &&
  //   String(employeeId) !== "";

  return db.sequelize.transaction(async (t) => {
    const result = await CashInOut.create(data, { transaction: t });

    if (hasSupplierId) {
      const supplierData = {
        supplierId,
        bookId,
        amount,
        status: "Paid",
        date,
        file,
      };

      console.log("supplierData", supplierData);

      await SupplierHistory.create(supplierData, { transaction: t });
    }

    return result;
  });
};

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE on searchable fields)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: CashInOutSearchableFields.map((field) => ({
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

//   const result = await CashInOut.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   const total = await CashInOut.count({ where: whereConditions });

//   return {
//     meta: { total, page, limit },
//     data: result,
//   };
// };

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const {
//     searchTerm,
//     startDate,
//     endDate,
//     paymentMode,
//     paymentStatus,
//     bookId,
//     ...otherFilters
//   } = filters;

//   const andConditions = [];

//   console.log("searchTerm", searchTerm);

//   // if (searchTerm) {
//   //   andConditions.push({
//   //     [Op.or]: CashInOutSearchableFields.map((field) => ({
//   //       [field]: { [Op.like]: `%${searchTerm}%` }, // Postgres হলে Op.iLike
//   //     })),
//   //   });
//   // }

//   if (searchTerm && String(searchTerm).trim()) {
//     const term = String(searchTerm).trim();

//     andConditions.push({
//       [Op.or]: [
//         { status: { [Op.like]: `%${term}%` } },
//         { remarks: { [Op.like]: `%${term}%` } },
//         { paymentMode: { [Op.like]: `%${term}%` } },
//         { paymentStatus: { [Op.like]: `%${term}%` } },
//         { category: { [Op.like]: `%${term}%` } },

//         db.Sequelize.where(
//           db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"),
//           { [Op.like]: `%${term}%` },
//         ),

//         db.Sequelize.where(
//           db.Sequelize.cast(db.Sequelize.col("bankAccount"), "CHAR"),
//           { [Op.like]: `%${term}%` },
//         ),
//       ],
//     });
//   }

//   // ✅ Date range filter (createdAt)
//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       date: { [Op.between]: [start, end] },
//     });
//   } else if (startDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     andConditions.push({
//       date: { [Op.gte]: start },
//     });
//   } else if (endDate) {
//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       date: { [Op.lte]: end },
//     });
//   }
//   // ✅ exact filters
//   if (paymentMode) {
//     andConditions.push({ paymentMode: { [Op.eq]: paymentMode } });
//   }
//   if (paymentStatus) {
//     andConditions.push({ paymentStatus: { [Op.eq]: paymentStatus } });
//   }
//   if (bookId) {
//     andConditions.push({ bookId: { [Op.eq]: bookId } });
//   }

//   if (Object.keys(otherFilters).length) {
//     andConditions.push(
//       ...Object.entries(otherFilters).map(([key, value]) => ({
//         [key]: { [Op.eq]: value },
//       })),
//     );
//   }
//   // ✅ Exclude soft deleted records
//   andConditions.push({
//     deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
//   });

//   const whereConditions = andConditions.length
//     ? { [Op.and]: andConditions }
//     : {};

//   const data = await CashInOut.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     paranoid: true,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["date", "DESC"]],
//   });

//   // const total = await CashInOut.count({ where: whereConditions });
//   const [count, totalCashIn, totalCashOut] = await Promise.all([
//     CashInOut.count({ where: whereConditions }),
//     CashInOut.sum("amount", {
//       where: { ...whereConditions, paymentStatus: "CashIn" },
//     }),
//     CashInOut.sum("amount", {
//       where: { ...whereConditions, paymentStatus: "CashOut" },
//     }),
//   ]);

//   const cashIn = Number(totalCashIn || 0);
//   const cashOut = Number(totalCashOut || 0);
//   const netBalance = cashIn - cashOut;

//   return {
//     meta: {
//       count,
//       totalCashIn: cashIn,
//       totalCashOut: cashOut,
//       netBalance,
//       page,
//       limit,
//     },
//     data,
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

  const baseConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();

    baseConditions.push({
      [Op.or]: [
        { status: { [Op.like]: `%${term}%` } },
        { remarks: { [Op.like]: `%${term}%` } },
        { paymentMode: { [Op.like]: `%${term}%` } },
        { paymentStatus: { [Op.like]: `%${term}%` } },
        { category: { [Op.like]: `%${term}%` } },
        { bankAccount: { [Op.like]: `%${term}%` } },

        db.Sequelize.where(
          db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"),
          { [Op.like]: `%${term}%` },
        ),

        // db.Sequelize.where(
        //   db.Sequelize.cast(db.Sequelize.col("bankAccount"), "CHAR"),
        //   { [Op.like]: `%${term}%` },
        // ),
      ],
    });
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    baseConditions.push({
      date: { [Op.between]: [start, end] },
    });
  } else if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    baseConditions.push({
      date: { [Op.gte]: start },
    });
  } else if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    baseConditions.push({
      date: { [Op.lte]: end },
    });
  }

  if (paymentMode) {
    baseConditions.push({ paymentMode: { [Op.eq]: paymentMode } });
  }

  if (paymentStatus) {
    baseConditions.push({ paymentStatus: { [Op.eq]: paymentStatus } });
  }

  if (bookId) {
    baseConditions.push({ bookId: { [Op.eq]: bookId } });
  }

  if (Object.keys(otherFilters).length) {
    baseConditions.push(
      ...Object.entries(otherFilters)
        .filter(
          ([_, value]) => value !== undefined && value !== null && value !== "",
        )
        .map(([key, value]) => ({
          [key]: { [Op.eq]: value },
        })),
    );
  }

  // baseConditions.push({
  //   deletedAt: { [Op.is]: null },
  // });

  const listWhere = baseConditions.length ? { [Op.and]: baseConditions } : {};

  const cashInWhere = {
    [Op.and]: [...baseConditions, { paymentStatus: "CashIn" }],
  };

  const cashOutWhere = {
    [Op.and]: [...baseConditions, { paymentStatus: "CashOut" }],
  };

  const data = await CashInOut.findAll({
    where: listWhere,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["date", "DESC"]],
  });

  const [count, totalCashIn, totalCashOut] = await Promise.all([
    CashInOut.count({ where: listWhere }),
    CashInOut.sum("amount", { where: cashInWhere }),
    CashInOut.sum("amount", { where: cashOutWhere }),
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

const getLoanSummaries = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const where = buildLoanWhere(filters);

  const data = await CashInOut.findAll({
    attributes: [
      "lender",
      ...loanSumAttributes,
      [db.Sequelize.fn("MAX", db.Sequelize.col("date")), "lastDate"],
    ],
    where,
    group: ["lender"],
    order: [[db.Sequelize.fn("MAX", db.Sequelize.col("date")), "DESC"]],
    offset: skip,
    limit,
    raw: true,
  });

  const [count, totals] = await Promise.all([
    CashInOut.count({
      where,
      distinct: true,
      col: "lender",
    }),
    CashInOut.findOne({
      attributes: loanSumAttributes,
      where,
      raw: true,
    }),
  ]);

  const totalLoanTaken = Number(totals?.totalLoanTaken || 0);
  const totalLoanGiven = Number(totals?.totalLoanGiven || 0);

  return {
    meta: {
      count,
      totalLoanTaken,
      totalLoanGiven,
      netBalance: totalLoanTaken - totalLoanGiven,
      page,
      limit,
    },
    data: data.map((row) => {
      const taken = Number(row.totalLoanTaken || 0);
      const given = Number(row.totalLoanGiven || 0);

      return {
        lender: row.lender,
        totalLoanTaken: taken,
        totalLoanGiven: given,
        netBalance: taken - given,
        lastDate: row.lastDate,
      };
    }),
  };
};

const getLoanHistory = async (lender, filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const where = buildLoanWhere({ ...filters, lender });

  const [data, count, totals] = await Promise.all([
    CashInOut.findAll({
      where,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"]],
    }),
    CashInOut.count({ where }),
    CashInOut.findOne({
      attributes: loanSumAttributes,
      where,
      raw: true,
    }),
  ]);

  const totalLoanTaken = Number(totals?.totalLoanTaken || 0);
  const totalLoanGiven = Number(totals?.totalLoanGiven || 0);

  return {
    meta: {
      count,
      totalLoanTaken,
      totalLoanGiven,
      netBalance: totalLoanTaken - totalLoanGiven,
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) => {
  const result = await CashInOut.findAll({
    where: {
      bookId: id,
    },
    paranoid: true,
    order: [["date", "DESC"]],
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await CashInOut.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { note, status, amount, userId, bookId, supplierId, date, file } =
    payload;
  const hasSupplierId =
    supplierId !== undefined &&
    supplierId !== null &&
    String(supplierId) !== "";

  console.log("supplierDetails", payload);
  return db.sequelize.transaction(async (t) => {
    const [updatedCount] = await CashInOut.update(payload, {
      where: {
        Id: id,
      },
      transaction: t,
    });

    if (hasSupplierId) {
      const supplierData = {
        supplierId,
        bookId,
        amount,
        status: "Paid",
        date,
        file,
      };

      await SupplierHistory.update(supplierData, {
        where: { supplierId },
        transaction: t,
      });
    }

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
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await CashInOut.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const CashInOutService = {
  getAllFromDB,
  getLoanSummaries,
  getLoanHistory,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = CashInOutService;

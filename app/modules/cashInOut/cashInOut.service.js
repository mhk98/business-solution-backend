const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { CashInOutSearchableFields } = require("./cashInOut.constants");
const { Op } = require("sequelize");
const CashInOut = db.cashInOut;
const Notification = db.notification;
const User = db.user;
const SupplierHistory = db.supplierHistory;
const Loan = db.loan;
const Category = db.category;
const Owner = db.owner;
const Director = db.director;
const Book = db.book;
const OwnerTransaction = db.ownerTransaction;
const DirectorProfitShare = db.directorProfitShare;
const Manufacturer = db.manufacturer;
const ManufacturerTransaction = db.manufacturerTransaction;
const PackagingManufacturer = db.packagingManufacturer;
const PackagingManufacturerTransaction = db.packagingManufacturerTransaction;

const toDateOnly = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMonthRange = (value) => {
  const sourceDate = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
  const year = safeDate.getFullYear();
  const month = safeDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    date: formatDateOnly(safeDate),
    start: formatDateOnly(start),
    end: formatDateOnly(end),
  };
};

const normalizeVoucherPrefix = (value) => {
  const prefix = String(value || "KM-")
    .trim()
    .replace(/[^A-Za-z0-9-]/g, "");

  if (!prefix) return "KM-";

  return prefix.endsWith("-") ? prefix : `${prefix}-`;
};

const generateMonthlyVoucherNo = async (date, voucherPrefix, transaction) => {
  const { start, end, date: normalizedDate } = getMonthRange(date);
  const prefix = normalizeVoucherPrefix(voucherPrefix);
  const count = await CashInOut.count({
    where: {
      voucherNo: { [Op.like]: `${prefix}%` },
      date: { [Op.between]: [start, end] },
    },
    paranoid: true,
    transaction,
  });

  const [year, month] = normalizedDate.split("-");
  const monthYearSuffix = `${month}${year.slice(-2)}`;

  return `${prefix}${String(count + 1).padStart(4, "0")}${monthYearSuffix}`;
};

const normalizeCategoryName = (value) => {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (!text || ["undefined", "null"].includes(text.toLowerCase())) {
    return null;
  }

  return text;
};

const resolveCategoryFields = async (data, transaction) => {
  const hasCategoryId =
    data.categoryId !== undefined &&
    data.categoryId !== null &&
    String(data.categoryId).trim() !== "";

  if (hasCategoryId) {
    const categoryId = Number(data.categoryId);
    if (Number.isNaN(categoryId)) {
      throw new ApiError(400, "CategoryId must be a valid number");
    }

    const category = await Category.findByPk(categoryId, { transaction });
    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    return { categoryId: category.Id, category: category.name };
  }

  const categoryName = normalizeCategoryName(data.category);
  if (!categoryName) return { categoryId: null, category: null };

  const categories = await Category.findAll({
    paranoid: false,
    transaction,
  });
  const existing = categories.find(
    (category) =>
      String(category.name || "").trim().toLowerCase() ===
      categoryName.toLowerCase(),
  );

  if (existing) {
    if (typeof existing.restore === "function" && existing.deletedAt) {
      await existing.restore({ transaction });
    }

    return { categoryId: existing.Id, category: existing.name };
  }

  const created = await Category.create({ name: categoryName }, { transaction });
  return { categoryId: created.Id, category: created.name };
};

const buildLoanWhere = (filters = {}, extraConditions = []) => {
  const { searchTerm, startDate, endDate, lender, loanId } = filters;
  const conditions = [
    {
      [Op.or]: [
        db.Sequelize.where(
          db.Sequelize.fn("LOWER", db.Sequelize.col("category")),
          {
            [Op.eq]: "loan",
          },
        ),
        { loanId: { [Op.ne]: null } },
      ],
    },
    ...extraConditions,
  ];

  if (loanId) {
    conditions.push({ loanId: { [Op.eq]: loanId } });
  }

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
  const {
    amount,
    date,
    bookId,
    supplierId,
    manufacturerId,
    packagingManufacturerId,
    ownerId,
    directorId,
    employeeId,
    file,
    voucherPrefix,
    note,
    paymentStatus,
    remarks,
    status,
  } = data;
  const hasSupplierId =
    supplierId !== undefined &&
    supplierId !== null &&
    String(supplierId) !== "";
  const hasManufacturerId =
    manufacturerId !== undefined &&
    manufacturerId !== null &&
    String(manufacturerId) !== "";
  const hasPackagingManufacturerId =
    packagingManufacturerId !== undefined &&
    packagingManufacturerId !== null &&
    String(packagingManufacturerId) !== "";
  const finalOwnerId = normalizeOptionalId(ownerId);
  const finalDirectorId = normalizeOptionalId(directorId);
  const finalBookId = normalizeOptionalId(bookId);
  const shouldSyncOwnerTransaction = ownerId !== undefined;
  const hasOwnerId = shouldSyncOwnerTransaction && Boolean(finalOwnerId);
  const shouldSyncDirectorProfitShare = directorId !== undefined;
  const hasDirectorId =
    shouldSyncDirectorProfitShare && Boolean(finalDirectorId);

  // const hasEmployeeId =
  //   employeeId !== undefined &&
  //   employeeId !== null &&
  //   String(employeeId) !== "";

  return db.sequelize.transaction(async (t) => {
    if (hasOwnerId) {
      if (!finalBookId) throw new ApiError(400, "Book is required!");
      const [owner, book] = await Promise.all([
        Owner.findByPk(finalOwnerId, { transaction: t }),
        Book.findByPk(finalBookId, { transaction: t }),
      ]);
      if (!owner) throw new ApiError(404, "Owner not found");
      if (!book) throw new ApiError(404, "Book not found");
    }

    if (hasDirectorId) {
      if (!finalBookId) throw new ApiError(400, "Book is required!");
      const [director, book] = await Promise.all([
        Director.findByPk(finalDirectorId, { transaction: t }),
        Book.findByPk(finalBookId, { transaction: t }),
      ]);
      if (!director) throw new ApiError(404, "Director not found");
      if (!book) throw new ApiError(404, "Book not found");
    }

    let manufacturer = null;
    if (hasManufacturerId) {
      manufacturer = await Manufacturer.findByPk(manufacturerId, {
        transaction: t,
      });
      if (!manufacturer) throw new ApiError(404, "Manufacturer not found");
    }

    let packagingManufacturer = null;
    if (hasPackagingManufacturerId) {
      packagingManufacturer = await PackagingManufacturer.findByPk(
        packagingManufacturerId,
        { transaction: t },
      );
      if (!packagingManufacturer)
        throw new ApiError(404, "Packaging manufacturer not found");
    }

    const voucherNo = await generateMonthlyVoucherNo(date, voucherPrefix, t);
    const { date: normalizedDate } = getMonthRange(date);
    const { voucherPrefix: _voucherPrefix, ...cashInOutData } = data;
    const categoryFields = await resolveCategoryFields(cashInOutData, t);
    const result = await CashInOut.create(
      {
        ...cashInOutData,
        ...categoryFields,
        date: date || normalizedDate,
        voucherNo,
      },
      { transaction: t },
    );

    if (hasSupplierId) {
      const supplierData = {
        supplierId,
        bookId,
        amount,
        status: "Paid",
        date,
        file,
        note,
      };

      console.log("supplierData", supplierData);

      await SupplierHistory.create(supplierData, { transaction: t });
    }

    if (hasManufacturerId) {
      await ManufacturerTransaction.create(
        {
          manufacturerId,
          manufacturerName: manufacturer.name,
          mixerId: null,
          type: "PAYMENT",
          description: "Manufacturer payment (Book)",
          debit: 0,
          credit: amount,
          date: date || normalizedDate,
          note: note || "",
        },
        { transaction: t },
      );
    }

    if (hasPackagingManufacturerId) {
      await PackagingManufacturerTransaction.create(
        {
          manufacturerId: packagingManufacturerId,
          manufacturerName: packagingManufacturer.name,
          mixerId: null,
          type: "PAYMENT",
          description: "Packaging manufacturer payment (Book)",
          debit: 0,
          credit: amount,
          date: date || normalizedDate,
          note: note || "",
        },
        { transaction: t },
      );
    }

    if (hasOwnerId) {
      await OwnerTransaction.create(
        {
          ownerId: finalOwnerId,
          bookId: finalBookId,
          cashInOutId: result.Id,
          type: paymentStatus === "CashOut" ? "Withdraw" : "Deposit",
          amount,
          remarks: remarks || note || "",
          date: date || normalizedDate,
          status: status || "Active",
        },
        { transaction: t },
      );
    }

    if (hasDirectorId) {
      await DirectorProfitShare.create(
        {
          directorId: finalDirectorId,
          bookId: finalBookId,
          cashInOutId: result.Id,
          type: paymentStatus === "CashOut" ? "Profit" : "Invest",
          amount,
          remarks: remarks || note || "",
          date: date || normalizedDate,
          status: status || "Active",
        },
        { transaction: t },
      );
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
    categoryId,
    voucherNo,
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
        { voucherNo: { [Op.like]: `%${term}%` } },
        { refNo: { [Op.like]: `%${term}%` } },

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
    baseConditions.push({
      date: { [Op.between]: [toDateOnly(startDate), toDateOnly(endDate)] },
    });
  } else if (startDate) {
    baseConditions.push({
      date: { [Op.gte]: toDateOnly(startDate) },
    });
  } else if (endDate) {
    baseConditions.push({
      date: { [Op.lte]: toDateOnly(endDate) },
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

  if (categoryId) {
    baseConditions.push({ categoryId: { [Op.eq]: categoryId } });
  }

  if (voucherNo && String(voucherNo).trim()) {
    baseConditions.push({
      voucherNo: { [Op.like]: `%${String(voucherNo).trim()}%` },
    });
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
    include: [
      { model: Loan, as: "loan", required: false },
      { model: Owner, as: "owner", required: false },
      { model: Director, as: "director", required: false },
      { model: Category, as: "categoryInfo", required: false },
    ],
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
      "loanId",
      "lender",
      ...loanSumAttributes,
      [db.Sequelize.fn("MAX", db.Sequelize.col("date")), "lastDate"],
    ],
    where,
    include: [{ model: Loan, as: "loan", attributes: [], required: false }],
    group: ["loanId", "lender"],
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
        loanId: row.loanId,
        lender: row.lender,
        totalLoanTaken: taken,
        totalLoanGiven: given,
        netBalance: taken - given,
        lastDate: row.lastDate,
      };
    }),
  };
};

const getLoanHistory = async (loanIdentifier, filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const identifier = String(loanIdentifier || "").trim();
  const isNumericId = identifier && /^\d+$/.test(identifier);
  const where = buildLoanWhere({
    ...filters,
    ...(isNumericId ? { loanId: Number(identifier) } : { lender: identifier }),
  });

  const [data, count, totals] = await Promise.all([
    CashInOut.findAll({
      where,
      include: [{ model: Loan, as: "loan", required: false }],
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
    include: [
      { model: Loan, as: "loan", required: false },
      { model: Owner, as: "owner", required: false },
      { model: Director, as: "director", required: false },
      { model: Category, as: "categoryInfo", required: false },
    ],
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
  const {
    note,
    status,
    amount,
    userId,
    bookId,
    supplierId,
    manufacturerId,
    packagingManufacturerId,
    ownerId,
    directorId,
    date,
    file,
    paymentStatus,
    remarks,
  } = payload;
  const hasSupplierId =
    supplierId !== undefined &&
    supplierId !== null &&
    String(supplierId) !== "";
  const hasManufacturerId =
    manufacturerId !== undefined &&
    manufacturerId !== null &&
    String(manufacturerId) !== "";
  const hasPackagingManufacturerId =
    packagingManufacturerId !== undefined &&
    packagingManufacturerId !== null &&
    String(packagingManufacturerId) !== "";
  const finalOwnerId = normalizeOptionalId(ownerId);
  const finalDirectorId = normalizeOptionalId(directorId);
  const finalBookId = normalizeOptionalId(bookId);
  const shouldSyncOwnerTransaction = ownerId !== undefined;
  const hasOwnerId = shouldSyncOwnerTransaction && Boolean(finalOwnerId);
  const shouldSyncDirectorProfitShare = directorId !== undefined;
  const hasDirectorId =
    shouldSyncDirectorProfitShare && Boolean(finalDirectorId);

  console.log("supplierDetails", payload);
  return db.sequelize.transaction(async (t) => {
    if (hasOwnerId) {
      if (!finalBookId) throw new ApiError(400, "Book is required!");
      const [owner, book] = await Promise.all([
        Owner.findByPk(finalOwnerId, { transaction: t }),
        Book.findByPk(finalBookId, { transaction: t }),
      ]);
      if (!owner) throw new ApiError(404, "Owner not found");
      if (!book) throw new ApiError(404, "Book not found");
    }

    if (hasDirectorId) {
      if (!finalBookId) throw new ApiError(400, "Book is required!");
      const [director, book] = await Promise.all([
        Director.findByPk(finalDirectorId, { transaction: t }),
        Book.findByPk(finalBookId, { transaction: t }),
      ]);
      if (!director) throw new ApiError(404, "Director not found");
      if (!book) throw new ApiError(404, "Book not found");
    }

    const shouldResolveCategory =
      (payload.categoryId !== undefined &&
        payload.categoryId !== null &&
        String(payload.categoryId).trim() !== "") ||
      (payload.category !== undefined &&
        payload.category !== null &&
        String(payload.category).trim() !== "");
    const categoryFields = shouldResolveCategory
      ? await resolveCategoryFields(payload, t)
      : {};

    const [updatedCount] = await CashInOut.update(
      { ...payload, ...categoryFields },
      {
      where: {
        Id: id,
      },
      transaction: t,
      },
    );

    if (hasSupplierId) {
      const supplierData = {
        supplierId,
        bookId,
        amount,
        status: "Paid",
        date,
        file,
        note,
      };

      await SupplierHistory.create(supplierData, { transaction: t });
    }

    if (hasManufacturerId) {
      const manufacturer = await Manufacturer.findByPk(manufacturerId, {
        transaction: t,
      });
      if (!manufacturer) throw new ApiError(404, "Manufacturer not found");

      await ManufacturerTransaction.create(
        {
          manufacturerId,
          manufacturerName: manufacturer.name,
          mixerId: null,
          type: "PAYMENT",
          description: "Manufacturer payment (Book)",
          debit: 0,
          credit: amount,
          date,
          note: note || "",
        },
        { transaction: t },
      );
    }

    if (hasPackagingManufacturerId) {
      const packagingManufacturer = await PackagingManufacturer.findByPk(
        packagingManufacturerId,
        { transaction: t },
      );
      if (!packagingManufacturer)
        throw new ApiError(404, "Packaging manufacturer not found");

      await PackagingManufacturerTransaction.create(
        {
          manufacturerId: packagingManufacturerId,
          manufacturerName: packagingManufacturer.name,
          mixerId: null,
          type: "PAYMENT",
          description: "Packaging manufacturer payment (Book)",
          debit: 0,
          credit: amount,
          date,
          note: note || "",
        },
        { transaction: t },
      );
    }

    const existingOwnerTransaction = shouldSyncOwnerTransaction
      ? await OwnerTransaction.findOne({
          where: { cashInOutId: id },
          transaction: t,
          paranoid: false,
        })
      : null;
    const existingDirectorProfitShare = shouldSyncDirectorProfitShare
      ? await DirectorProfitShare.findOne({
          where: { cashInOutId: id },
          transaction: t,
          paranoid: false,
        })
      : null;

    if (hasOwnerId) {
      const ownerTransactionData = {
        ownerId: finalOwnerId,
        bookId: finalBookId,
        cashInOutId: id,
        type: paymentStatus === "CashOut" ? "Withdraw" : "Deposit",
        amount,
        remarks: remarks || note || "",
        date,
        status: status || "Active",
      };

      if (existingOwnerTransaction) {
        if (
          existingOwnerTransaction.deletedAt &&
          typeof existingOwnerTransaction.restore === "function"
        ) {
          await existingOwnerTransaction.restore({ transaction: t });
        }
        await existingOwnerTransaction.update(ownerTransactionData, {
          transaction: t,
        });
      } else {
        await OwnerTransaction.create(ownerTransactionData, { transaction: t });
      }
    } else if (shouldSyncOwnerTransaction && existingOwnerTransaction) {
      await existingOwnerTransaction.destroy({ transaction: t });
    }

    if (hasDirectorId) {
      const directorProfitShareData = {
        directorId: finalDirectorId,
        bookId: finalBookId,
        cashInOutId: id,
        type: paymentStatus === "CashOut" ? "Profit" : "Invest",
        amount,
        remarks: remarks || note || "",
        date,
        status: status || "Active",
      };

      if (existingDirectorProfitShare) {
        if (
          existingDirectorProfitShare.deletedAt &&
          typeof existingDirectorProfitShare.restore === "function"
        ) {
          await existingDirectorProfitShare.restore({ transaction: t });
        }
        await existingDirectorProfitShare.update(directorProfitShareData, {
          transaction: t,
        });
      } else {
        await DirectorProfitShare.create(directorProfitShareData, {
          transaction: t,
        });
      }
    } else if (shouldSyncDirectorProfitShare && existingDirectorProfitShare) {
      await existingDirectorProfitShare.destroy({ transaction: t });
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
    include: [
      { model: Loan, as: "loan", required: false },
      { model: Owner, as: "owner", required: false },
      { model: Director, as: "director", required: false },
      { model: Category, as: "categoryInfo", required: false },
    ],
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

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const { LedgerSearchableFields } = require("./ledger.constants");
const Ledger = db.ledger;
const LedgerHistory = db.ledgerHistory;
const EmployeeList = db.employeeList;
const SupplierHistory = db.supplierHistory;
const CashInOut = db.cashInOut;

const normalizeOptionalForeignKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    return trimmedValue;
  }

  return value;
};

const normalizeLedgerPayload = (payload) => {
  const paymentMode = String(payload?.paymentMode || "").trim();

  const normalizedPayload = {
    role: payload?.role,
    name: payload?.name,
    phone: payload?.phone,
    countryCode: payload?.countryCode,
    address: payload?.address,
    amount: payload?.amount,
    cashType: payload?.cashType,
    note: payload?.note,
    date: payload?.date,
    bookId: payload?.bookId,
    file: payload?.file,
    sendMessage: payload?.sendMessage,
    status: payload?.status,
    paymentMode,
    bankName: paymentMode === "Bank" ? payload?.bankName || "" : "",
    bankAccount: paymentMode === "Bank" ? payload?.bankAccount || null : null,
    supplierId: normalizeOptionalForeignKey(payload?.supplierId),
    employeeId: normalizeOptionalForeignKey(payload?.employeeId),
  };

  if (normalizedPayload.role === "Supplier") {
    normalizedPayload.employeeId = null;
  }

  if (normalizedPayload.role === "Employee") {
    normalizedPayload.supplierId = null;
  }

  return normalizedPayload;
};

const resolveEmployeeListId = async (employeeId) => {
  const normalizedEmployeeId = normalizeOptionalForeignKey(employeeId);

  if (!normalizedEmployeeId) {
    return null;
  }

  const employeeRecord = await EmployeeList.findOne({
    where: {
      [Op.or]: [
        { Id: normalizedEmployeeId },
        { employee_id: normalizedEmployeeId },
      ],
    },
    order: [
      ["status", "ASC"],
      ["createdAt", "DESC"],
    ],
  });

  if (!employeeRecord) {
    throw new ApiError(
      400,
      `Employee not found in EmployeeLists for value "${normalizedEmployeeId}"`,
    );
  }

  return employeeRecord.Id;
};

const insertIntoDB = async (data) => {
  const normalizedData = normalizeLedgerPayload(data);

  return db.sequelize.transaction(async (t) => {
    if (normalizedData.role === "Employee") {
      normalizedData.employeeId = await resolveEmployeeListId(
        normalizedData.employeeId,
      );
    }

    const {
      cashType,
      amount,
      note,
      date,
      supplierId,
      employeeId,
      bookId,
      file,
      paymentMode,
      bankName,
      bankAccount,
    } = normalizedData;

    const result = await Ledger.create(normalizedData, { transaction: t });

    let supplierHistoryId = null;
    let cashInOutId = null;

    if (supplierId) {
      // SupplierHistory — বাকি যোগ = Unpaid, পরিশোধ = Paid
      const supplierHistory = await SupplierHistory.create(
        {
          supplierId,
          bookId,
          amount,
          status: cashType,
          date: date || new Date(),
          note: note || "",
        },
        { transaction: t },
      );
      supplierHistoryId = supplierHistory.Id;

      // CashInOut — শুধু পরিশোধ (Paid) হলে CashOut। বাকি যোগ (Unpaid) হলে cash movement নেই।
      if (cashType === "Paid") {
        const cashInOut = await CashInOut.create(
          {
            supplierId,
            bookId,
            paymentMode,
            bankName,
            bankAccount,
            paymentStatus: "CashOut",
            amount,
            status: "Active",
            date,
            file,
          },
          { transaction: t },
        );
        cashInOutId = cashInOut.Id;
      }
    }

    if (employeeId) {
      const cashInOut = await CashInOut.create(
        {
          employeeId,
          bookId,
          paymentMode,
          bankName,
          bankAccount,
          paymentStatus: "CashOut",
          amount,
          status: "Active",
          category: "Employee Advance",
          date,
          note: note || "",
        },
        { transaction: t },
      );
      cashInOutId = cashInOut.Id;
    }

    await LedgerHistory.create(
      {
        ledgerId: result.Id,
        supplierId,
        employeeId,
        bookId,
        supplierHistoryId,
        cashInOutId,
        status: cashType,
        paidAmount: cashType === "Paid" ? amount : 0,
        unpaidAmount: cashType === "Unpaid" ? amount : 0,
        date: date || new Date(),
        note: note || "",
      },
      { transaction: t },
    );

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, name, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    andConditions.push({
      [Op.or]: LedgerSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  if (name && String(name).trim()) {
    andConditions.push({
      name: { [Op.like]: `%${String(name).trim()}%` },
    });
  }

  if (startDate && endDate) {
    andConditions.push({
      date: { [Op.between]: [startDate, endDate] },
    });
  } else if (startDate) {
    andConditions.push({
      date: { [Op.gte]: startDate },
    });
  } else if (endDate) {
    andConditions.push({
      date: { [Op.lte]: endDate },
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, String(options.sortOrder).toUpperCase()]]
      : [["createdAt", "DESC"]];

  const [data, count, totalAmount] = await Promise.all([
    Ledger.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order,
    }),
    Ledger.count({ where: whereConditions }),
    Ledger.sum("amount", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalAmount: totalAmount || 0, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  const result = await Ledger.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const normalizedPayload = normalizeLedgerPayload(payload);

  if (normalizedPayload.role === "Employee" && normalizedPayload.employeeId) {
    normalizedPayload.employeeId = await resolveEmployeeListId(
      normalizedPayload.employeeId,
    );
  }

  const result = await Ledger.update(normalizedPayload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Ledger.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Ledger.findAll({
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const LedgerService = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = LedgerService;

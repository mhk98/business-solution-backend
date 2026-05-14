const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { LedgerHistorySearchableFields } = require("./ledgerHistory.constants");
const LedgerHistory = db.ledgerHistory;
const Ledger = db.ledger;
const CashInOut = db.cashInOut;
const SupplierHistory = db.supplierHistory;
const EmployeeList = db.employeeList;

const normalizeOptionalForeignKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  return value;
};

const normalizePrimaryKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "object") {
    if (value.Id !== undefined && value.Id !== null) {
      return value.Id;
    }

    if (value.id !== undefined && value.id !== null) {
      return value.id;
    }
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  return value;
};

const resolveEmployeeLedgerIds = async (employeeId) => {
  const normalizedEmployeeId = normalizeOptionalForeignKey(employeeId);

  if (!normalizedEmployeeId) return [];

  const employee = await EmployeeList.findOne({
    where: {
      [Op.or]: [
        { Id: normalizedEmployeeId },
        { employee_id: normalizedEmployeeId },
      ],
    },
    attributes: ["Id", "employee_id"],
  });

  const ids = [normalizedEmployeeId, employee?.Id, employee?.employee_id]
    .map((value) => {
      if (value === undefined || value === null || value === "") return null;

      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    })
    .filter((value) => value !== null);

  return [...new Set(ids)];
};

const getLedgerHistoryEntryType = (entry = {}) => {
  const status = String(entry?.status || entry?.cashType || "").trim();

  if (status === "Paid" || status === "Unpaid") {
    return status;
  }

  return getSafeAmount(entry?.paidAmount) > 0 ? "Paid" : "Unpaid";
};

const getSafeAmount = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getLedgerHistoryAmount = (entry = {}) =>
  getLedgerHistoryEntryType(entry) === "Paid"
    ? getSafeAmount(entry?.paidAmount)
    : getSafeAmount(entry?.unpaidAmount);

const buildSupplierHistoryPayload = ({ entryType, amount, payload, existing }) => ({
  supplierId: normalizeOptionalForeignKey(
    payload?.supplierId ?? existing?.supplierId,
  ),
  bookId: normalizeOptionalForeignKey(payload?.bookId ?? existing?.bookId),
  amount,
  status: entryType,
  date: payload?.date ?? existing?.date ?? new Date(),
  note: payload?.note ?? existing?.note ?? "",
});

const buildCashInOutPayload = ({ amount, payload, existing }) => ({
  supplierId: normalizeOptionalForeignKey(
    payload?.supplierId ?? existing?.supplierId,
  ),
  employeeId: normalizeOptionalForeignKey(
    payload?.employeeId ?? existing?.employeeId,
  ),
  bookId: normalizeOptionalForeignKey(payload?.bookId ?? existing?.bookId),
  paymentStatus: "CashOut",
  amount,
  status: "Active",
  date: payload?.date ?? existing?.date ?? new Date(),
  note: payload?.note ?? existing?.note ?? "",
});

const findMatchingSupplierHistory = async (entry, transaction) => {
  if (!entry?.supplierId) return null;

  const where = {
    supplierId: entry.supplierId,
    amount: getLedgerHistoryAmount(entry),
    status: getLedgerHistoryEntryType(entry),
  };

  if (entry.bookId) where.bookId = entry.bookId;
  if (entry.date) where.date = entry.date;

  return SupplierHistory.findOne({
    where,
    paranoid: true,
    order: [["createdAt", "DESC"]],
    transaction,
  });
};

const findMatchingCashInOut = async (entry, transaction) => {
  if (getLedgerHistoryEntryType(entry) !== "Paid") return null;
  if (!entry?.supplierId && !entry?.employeeId) return null;

  const where = {
    paymentStatus: { [Op.in]: ["CashOut", "Paid"] },
    amount: getLedgerHistoryAmount(entry),
  };

  if (entry.supplierId) where.supplierId = entry.supplierId;
  if (entry.employeeId) where.employeeId = entry.employeeId;
  if (entry.bookId) where.bookId = entry.bookId;
  if (entry.date) where.date = entry.date;

  return CashInOut.findOne({
    where,
    paranoid: true,
    order: [["createdAt", "DESC"]],
    transaction,
  });
};

const insertIntoDB = async (payload) => {
  const {
    cashType,
    paidAmount,
    ledgerId: rawLedgerId,
    unpaidAmount,
    note,
    date,
    bookId,
    supplierId,
    employeeId,
  } = payload;

  console.log("payload", payload);
  const ledgerId = normalizePrimaryKey(rawLedgerId);

  if (!ledgerId) {
    throw new ApiError(400, "ledgerId is required");
  }

  const data = {
    paidAmount,
    unpaidAmount,
    status: cashType,
    ledgerId,
    bookId: normalizeOptionalForeignKey(bookId),
    supplierId: normalizeOptionalForeignKey(supplierId),
    employeeId: normalizeOptionalForeignKey(employeeId),
    note,
    date,
  };

  return db.sequelize.transaction(async (t) => {
    const existingLedger = await Ledger.findByPk(ledgerId, { transaction: t });

    if (!existingLedger) {
      throw new ApiError(404, "Ledger not found for the provided ledgerId");
    }

      let supplierHistoryId = null;
      let cashInOutId = null;

      if (supplierId) {
        // SupplierHistory — বাকি যোগ = Unpaid, পরিশোধ = Paid
        const supplierHistory = await SupplierHistory.create(
          {
            supplierId,
            bookId,
            amount: cashType === "Paid" ? paidAmount : unpaidAmount,
            status: cashType,
            date: date || new Date(),
            note: note || "",
          },
          { transaction: t },
        );
        supplierHistoryId = supplierHistory.Id;

        // CashInOut — শুধু পরিশোধ (Paid) হলে CashOut। বাকি যোগ (Unpaid) হলে কোনো cash movement নেই।
        if (cashType === "Paid") {
          const cashInOut = await CashInOut.create(
            {
              supplierId,
              bookId,
              paymentStatus: "CashOut",
              amount: paidAmount,
              status: "Active",
              date,
            },
            { transaction: t },
          );
          cashInOutId = cashInOut.Id;
        }
      }

      if (employeeId) {
        // CashInOut — শুধু পরিশোধ (Paid) হলে CashOut। বাকি যোগ (Unpaid) হলে কোনো cash movement নেই।
        if (cashType === "Paid") {
          const cashInOut = await CashInOut.create(
            {
              employeeId,
              bookId,
              paymentStatus: "CashOut",
              amount: paidAmount,
              status: "Active",
              date,
            },
            { transaction: t },
          );
          cashInOutId = cashInOut.Id;
        }
      }

    data.supplierHistoryId = supplierHistoryId;
    data.cashInOutId = cashInOutId;

    const result = await LedgerHistory.create(data, { transaction: t });

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, name, ...otherFilters } = filters;

  const andConditions = [];
  const normalizedOtherFilters = {};
  const employeeLedgerIds = await resolveEmployeeLedgerIds(otherFilters.employeeId);

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (key === "employeeId") {
      if (employeeLedgerIds.length === 1) {
        normalizedOtherFilters[key] = employeeLedgerIds[0];
      } else if (employeeLedgerIds.length > 1) {
        normalizedOtherFilters[key] = { [Op.in]: employeeLedgerIds };
      }

      return;
    }

    if (key === "supplierId") {
      const normalizedValue = normalizeOptionalForeignKey(value);

      if (normalizedValue !== null) {
        normalizedOtherFilters[key] = normalizedValue;
      }

      return;
    }

    if (value !== undefined && value !== null && value !== "") {
      normalizedOtherFilters[key] = value;
    }
  });

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    andConditions.push({
      [Op.or]: LedgerHistorySearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  // if (name && String(name).trim()) {
  //   andConditions.push({
  //     name: { [Op.like]: `%${String(name).trim()}%` },
  //   });
  // }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(normalizedOtherFilters).length) {
    andConditions.push(
      ...Object.entries(normalizedOtherFilters).map(([key, value]) => ({
        [key]: value && value[Op.in] ? value : { [Op.eq]: value },
      })),
    );
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

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, String(options.sortOrder).toUpperCase()]]
      : [["createdAt", "DESC"]];

  // const [ count, totalAmount] = await Promise.all([
  //   LedgerHistory.findAll({
  //     where: whereConditions,
  //     offset: skip,
  //     limit,
  //     order,
  //   }),
  //   LedgerHistory.count({ where: whereConditions }),
  //   LedgerHistory.sum("amount", { where: whereConditions }),
  // ]);

  const [result, count, totalPaidAmount, totalUnpaidAmount] = await Promise.all(
    [
      LedgerHistory.findAll({
        where: whereConditions,
        offset: skip,
        limit,
        include: [
          {
            model: Ledger,
            as: "ledger",
            attributes: ["Id", "name"],
          },
        ],
        paranoid: true,
        order:
          options.sortBy && options.sortOrder
            ? [[options.sortBy, options.sortOrder.toUpperCase()]]
            : [["date", "DESC"]],
      }),
      LedgerHistory.count({
        where: whereConditions,
      }),
      LedgerHistory.sum("paidAmount", {
        where: whereConditions,
      }),
      LedgerHistory.sum("unpaidAmount", {
        where: whereConditions,
      }),
    ],
  );

  const paid = Number(totalPaidAmount) || 0;
  const unpaid = Number(totalUnpaidAmount) || 0;
  const netBalance = unpaid - paid;

  return {
    meta: { count, page, limit, paid, unpaid, netBalance },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await LedgerHistory.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await LedgerHistory.findByPk(id, { transaction: t });

    if (!existing) {
      throw new ApiError(404, "LedgerHistory not found");
    }

    const nextEntryType =
      payload?.cashType ||
      payload?.status ||
      (getSafeAmount(payload?.paidAmount) > 0 ? "Paid" : "Unpaid");
    const nextAmount =
      nextEntryType === "Paid"
        ? getSafeAmount(payload?.paidAmount ?? payload?.amount)
        : getSafeAmount(payload?.unpaidAmount ?? payload?.amount);

    if (nextAmount <= 0) {
      throw new ApiError(400, "Amount must be greater than 0");
    }

    const normalizedPayload = {
      ledgerId: payload?.ledgerId ?? existing.ledgerId,
      supplierId: normalizeOptionalForeignKey(
        payload?.supplierId ?? existing.supplierId,
      ),
      employeeId: normalizeOptionalForeignKey(
        payload?.employeeId ?? existing.employeeId,
      ),
      bookId: normalizeOptionalForeignKey(payload?.bookId ?? existing.bookId),
      status: nextEntryType,
      paidAmount: nextEntryType === "Paid" ? nextAmount : 0,
      unpaidAmount: nextEntryType === "Unpaid" ? nextAmount : 0,
      date: payload?.date ?? existing.date,
      note: payload?.note ?? existing.note ?? "",
    };

    const previousSupplierHistory =
      existing.supplierHistoryId &&
      (await SupplierHistory.findByPk(existing.supplierHistoryId, {
        transaction: t,
      }));
    const fallbackSupplierHistory =
      previousSupplierHistory || (await findMatchingSupplierHistory(existing, t));

    let nextSupplierHistoryId = existing.supplierHistoryId || null;
    if (normalizedPayload.supplierId) {
      const supplierPayload = buildSupplierHistoryPayload({
        entryType: nextEntryType,
        amount: nextAmount,
        payload: normalizedPayload,
        existing,
      });

      if (fallbackSupplierHistory) {
        await fallbackSupplierHistory.update(supplierPayload, {
          transaction: t,
        });
        nextSupplierHistoryId = fallbackSupplierHistory.Id;
      } else {
        const supplierHistory = await SupplierHistory.create(supplierPayload, {
          transaction: t,
        });
        nextSupplierHistoryId = supplierHistory.Id;
      }
    } else if (fallbackSupplierHistory) {
      await fallbackSupplierHistory.destroy({ transaction: t });
      nextSupplierHistoryId = null;
    }

    const previousCashInOut =
      existing.cashInOutId &&
      (await CashInOut.findByPk(existing.cashInOutId, { transaction: t }));
    const fallbackCashInOut =
      previousCashInOut || (await findMatchingCashInOut(existing, t));

    let nextCashInOutId = existing.cashInOutId || null;
    if (nextEntryType === "Paid") {
      const cashPayload = buildCashInOutPayload({
        amount: nextAmount,
        payload: normalizedPayload,
        existing,
      });

      if (fallbackCashInOut) {
        await fallbackCashInOut.update(cashPayload, { transaction: t });
        nextCashInOutId = fallbackCashInOut.Id;
      } else {
        const cashInOut = await CashInOut.create(cashPayload, {
          transaction: t,
        });
        nextCashInOutId = cashInOut.Id;
      }
    } else if (fallbackCashInOut) {
      await fallbackCashInOut.destroy({ transaction: t });
      nextCashInOutId = null;
    }

    normalizedPayload.supplierHistoryId = nextSupplierHistoryId;
    normalizedPayload.cashInOutId = nextCashInOutId;

    const [updatedCount] = await LedgerHistory.update(normalizedPayload, {
      where: {
        Id: id,
      },
      transaction: t,
    });

    return updatedCount;
  });
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await LedgerHistory.findByPk(id, { transaction: t });

    if (!existing) {
      throw new ApiError(404, "LedgerHistory not found");
    }

    const linkedSupplierHistory =
      existing.supplierHistoryId &&
      (await SupplierHistory.findByPk(existing.supplierHistoryId, {
        transaction: t,
      }));
    const fallbackSupplierHistory =
      linkedSupplierHistory || (await findMatchingSupplierHistory(existing, t));

    if (fallbackSupplierHistory) {
      await fallbackSupplierHistory.destroy({ transaction: t });
    }

    const linkedCashInOut =
      existing.cashInOutId &&
      (await CashInOut.findByPk(existing.cashInOutId, { transaction: t }));
    const fallbackCashInOut =
      linkedCashInOut || (await findMatchingCashInOut(existing, t));

    if (fallbackCashInOut) {
      await fallbackCashInOut.destroy({ transaction: t });
    }

    const result = await LedgerHistory.destroy({
      where: {
        Id: id,
      },
      transaction: t,
    });

    return result;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await LedgerHistory.findAll({
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const LedgerHistoryService = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = LedgerHistoryService;

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const CashInOut = db.cashInOut;

const CHARGE_MODELS = {
  cod: db.codCharge,
  codchange: db.codChange,
  delivery: db.deliveryCharge,
  deliveryadvance: db.deliveryAdvance,
  shippingcharge: db.shippingCharge,
};

// Charge types that carry an employee link (rows synced from CS Work Reports).
const EMPLOYEE_LINKED_TYPES = new Set([
  "codchange",
  "deliveryadvance",
  "shippingcharge",
]);

const EmployeeList = db.employeeList;

const normalizeChargeType = (chargeType) => {
  const value = String(chargeType || "")
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, "");
  if (!CHARGE_MODELS[value]) {
    throw new ApiError(400, "Invalid charge type");
  }
  return value;
};

const getModelByType = (chargeType) => CHARGE_MODELS[normalizeChargeType(chargeType)];

const normalizeAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiError(400, "Charge amount must be a positive number");
  }
  return value.toFixed(2);
};

const normalizeDate = (date) => {
  const value = String(date || "").trim();
  if (!value) {
    throw new ApiError(400, "Date is required");
  }
  return value;
};

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const isDeliveryAdvance = (chargeType) =>
  normalizeChargeType(chargeType) === "deliveryadvance";

const normalizeDeliveryAdvanceDetails = (payload = {}) => {
  const paymentMode = String(payload.paymentMode || "").trim();
  const bankName = String(payload.bankName || "").trim();
  const bankAccount = normalizeOptionalId(payload.bankAccount);
  const bookId = normalizeOptionalId(payload.bookId);

  if (!bookId) {
    throw new ApiError(400, "Book is required");
  }

  if (!paymentMode) {
    throw new ApiError(400, "Payment mode is required");
  }

  if (paymentMode === "Bank" && (!bankName || !bankAccount)) {
    throw new ApiError(400, "Bank name and bank account are required");
  }

  return {
    bookId,
    paymentMode,
    bankName: paymentMode === "Bank" ? bankName : null,
    bankAccount: paymentMode === "Bank" ? bankAccount : null,
  };
};

const buildPayload = (payload, user) => {
  const data = {
    date: normalizeDate(payload?.date),
    amount: normalizeAmount(payload?.amount),
    note: String(payload?.note || "").trim() || null,
    createdByUserId: user?.Id || user?.id || null,
    createdByRole: user?.role || null,
  };

  if (isDeliveryAdvance(payload?.chargeType)) {
    Object.assign(data, normalizeDeliveryAdvanceDetails(payload));
  }

  return data;
};

const buildCashInPayload = (data) => ({
  bookId: data.bookId,
  paymentStatus: "CashIn",
  amount: data.amount,
  paymentMode: data.paymentMode,
  bankName: data.bankName,
  bankAccount: data.bankAccount,
  status: "Active",
  category: "Delivery Advance",
  date: data.date,
  note: data.note || "Delivery advance",
});

const createChargeSetting = async (payload, user) => {
  const chargeType = normalizeChargeType(payload?.chargeType);
  const Model = getModelByType(payload?.chargeType);
  const data = buildPayload(payload, user);

  if (chargeType !== "deliveryadvance") {
    return Model.create(data);
  }

  return db.sequelize.transaction(async (transaction) => {
    const row = await Model.create(data, { transaction });
    const cashInOut = await CashInOut.create(buildCashInPayload(data), {
      transaction,
    });
    await row.update({ cashInOutId: cashInOut.Id }, { transaction });
    return row;
  });
};

const getChargeSettings = async (filters, options) => {
  const { chargeType, searchTerm, from, to } = filters || {};
  const Model = getModelByType(chargeType);
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const andConditions = [{ deletedAt: { [Op.is]: null } }];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({ note: { [Op.like]: `%${searchTerm.trim()}%` } });
  }

  if (from || to) {
    const dateRange = {};
    if (from) dateRange[Op.gte] = String(from).trim();
    if (to) dateRange[Op.lte] = String(to).trim();
    andConditions.push({ date: dateRange });
  }

  const where = { [Op.and]: andConditions };
  const include = EMPLOYEE_LINKED_TYPES.has(normalizeChargeType(chargeType))
    ? [
        {
          model: EmployeeList,
          as: "employee",
          attributes: ["Id", "name", "employeeCode"],
          required: false,
        },
        {
          model: db.employeeWorkReport,
          as: "workReport",
          attributes: ["Id", "name"],
          required: false,
        },
      ]
    : [];
  const data = await Model.findAll({
    where,
    include,
    offset: skip,
    limit,
    order: [["date", "DESC"], ["createdAt", "DESC"]],
    paranoid: true,
  });
  const [count, totalAmount] = await Promise.all([
    Model.count({ where }),
    Model.sum("amount", { where }),
  ]);

  return {
    meta: { count, page, limit, totalAmount: Number(totalAmount) || 0 },
    data: data.map((row) => {
      const json = row.toJSON();
      return {
        ...json,
        employeeName: json.employee?.name || json.workReport?.name || null,
        isFromWorkReport: json.source === "cs_work_report",
      };
    }),
  };
};

const updateChargeSetting = async (id, payload) => {
  const chargeType = normalizeChargeType(payload?.chargeType);
  const Model = getModelByType(payload?.chargeType);
  const existing = await Model.findOne({ where: { Id: id } });
  if (!existing) {
    throw new ApiError(404, "Charge not found");
  }
  if (existing.source === "cs_work_report") {
    throw new ApiError(
      400,
      "This entry is managed from the CS Work Report and cannot be edited here",
    );
  }

  const next = {};
  if (payload.date !== undefined) {
    next.date = normalizeDate(payload.date);
  }
  if (payload.amount !== undefined) {
    next.amount = normalizeAmount(payload.amount);
  }
  if (payload.note !== undefined) {
    next.note = String(payload.note || "").trim() || null;
  }

  if (chargeType === "deliveryadvance") {
    Object.assign(next, normalizeDeliveryAdvanceDetails(payload));

    return db.sequelize.transaction(async (transaction) => {
      await existing.update(next, { transaction });
      const cashPayload = buildCashInPayload({
        ...existing.toJSON(),
        ...next,
      });

      if (existing.cashInOutId) {
        const [updated] = await CashInOut.update(cashPayload, {
          where: { Id: existing.cashInOutId },
          transaction,
        });

        if (!updated) {
          const cashInOut = await CashInOut.create(cashPayload, {
            transaction,
          });
          await existing.update(
            { cashInOutId: cashInOut.Id },
            { transaction },
          );
        }
      } else {
        const cashInOut = await CashInOut.create(cashPayload, {
          transaction,
        });
        await existing.update({ cashInOutId: cashInOut.Id }, { transaction });
      }

      return Model.findOne({ where: { Id: id }, transaction });
    });
  }

  await Model.update(next, { where: { Id: id } });
  return Model.findOne({ where: { Id: id } });
};

const deleteChargeSetting = async (id, chargeType) => {
  const normalizedType = normalizeChargeType(chargeType);
  const Model = getModelByType(chargeType);
  const existing = await Model.findOne({ where: { Id: id } });
  if (!existing) {
    throw new ApiError(404, "Charge not found");
  }
  if (existing.source === "cs_work_report") {
    throw new ApiError(
      400,
      "This entry is managed from the CS Work Report and cannot be deleted here",
    );
  }

  if (normalizedType === "deliveryadvance") {
    await db.sequelize.transaction(async (transaction) => {
      if (existing.cashInOutId) {
        await CashInOut.destroy({
          where: { Id: existing.cashInOutId },
          transaction,
        });
      }
      await existing.destroy({ transaction });
    });
    return { deleted: true };
  }

  await Model.destroy({ where: { Id: id } });
  return { deleted: true };
};

module.exports = {
  createChargeSetting,
  getChargeSettings,
  updateChargeSetting,
  deleteChargeSetting,
};

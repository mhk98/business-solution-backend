const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { SalaryAdvanceSearchableFields } = require("./salaryAdvance.constants");

const SalaryAdvance = db.salaryAdvance;

const normalizePayload = (payload = {}) => {
  const name = String(payload.name || "").trim();
  if (!name) throw new ApiError(400, "Name is required");

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  if (!payload.date) throw new ApiError(400, "Date is required");

  return {
    date: payload.date,
    name,
    amount,
  };
};

// A sales due entry's balance mirrors Supplier/Manufacturer: net balance =
// paidAmount - amount. A positive net balance is an advance (paid more than
// was due); a negative one is still due.
const attachBalance = (rows = []) =>
  rows.map((row) => {
    const amount = Number(row.amount || 0);
    const paidAmount = Number(row.paidAmount || 0);
    const netBalance = paidAmount - amount;
    const due = Math.max(-netBalance, 0);
    const advance = Math.max(netBalance, 0);

    if (typeof row.setDataValue === "function") {
      row.setDataValue("due", due);
      row.setDataValue("advance", advance);
      return row;
    }
    return { ...row, due, advance };
  });

const insertIntoDB = async (payload = {}) => {
  const data = normalizePayload(payload);
  return SalaryAdvance.create(data);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: SalaryAdvanceSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => ({ [key]: { [Op.eq]: value } })),
    );
  }

  if (startDate && endDate) {
    andConditions.push({ date: { [Op.between]: [startDate, endDate] } });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count, totalAmount, totalPaidAmount] = await Promise.all([
    SalaryAdvance.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["date", "DESC"], ["createdAt", "DESC"]],
    }),
    SalaryAdvance.count({ where: whereConditions }),
    SalaryAdvance.sum("amount", { where: whereConditions }),
    SalaryAdvance.sum("paidAmount", { where: whereConditions }),
  ]);

  return {
    meta: {
      count,
      totalAmount: totalAmount || 0,
      totalPaidAmount: totalPaidAmount || 0,
      page,
      limit,
    },
    data: attachBalance(data),
  };
};

const getDataById = async (id) => {
  const row = await SalaryAdvance.findOne({ where: { Id: id } });
  if (!row) return row;
  const [data] = attachBalance([row]);
  return data;
};

const updateOneFromDB = async (id, payload = {}) => {
  const data = normalizePayload(payload);
  const [updatedCount] = await SalaryAdvance.update(data, {
    where: { Id: id },
  });
  return updatedCount;
};

const deleteIdFromDB = async (id) => {
  return SalaryAdvance.destroy({ where: { Id: id } });
};

const addPaymentFromDB = async (id, payload = {}) => {
  const record = await SalaryAdvance.findOne({ where: { Id: id } });
  if (!record) throw new ApiError(404, "Salary Advance entry not found");

  const paymentAmount = Number(payload.amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new ApiError(400, "Payment amount must be greater than 0");
  }

  record.paidAmount = Number(record.paidAmount || 0) + paymentAmount;
  await record.save();

  const [data] = attachBalance([record]);
  return data;
};

const getAllFromDBWithoutQuery = async () => {
  const rows = await SalaryAdvance.findAll({
    paranoid: true,
    order: [["date", "DESC"], ["createdAt", "DESC"]],
  });
  return attachBalance(rows);
};

// Outstanding-due list consumed by the shared "All Books" / Monthly Reporting
// Book statement PDF and the Dashboard's Print/Download Book action (see
// inventoryOverview.service.js's getInventoryStockReport). `due` is the
// current (unfiltered) outstanding — the "বাকি" column. `openingBalance` /
// `endingBalance` scope the same entry's due to `date < from` and `date <= to`
// so the PDF can show the period movement (paidAmount is undated, so those are
// an approximation on the entry's own date).
const getSalaryAdvanceReport = async ({ from, to } = {}) => {
  const rows = await SalaryAdvance.findAll({
    order: [["date", "ASC"], ["createdAt", "ASC"]],
  });

  const data = rows
    .map((row) => {
      const due = Math.max(
        Number(row.amount || 0) - Number(row.paidAmount || 0),
        0,
      );
      const date = row.date || null;
      return {
        Id: row.Id,
        date,
        name: row.name,
        due,
        openingBalance: from && date && date < from ? due : 0,
        endingBalance: !to || (date && date <= to) ? due : 0,
      };
    })
    .filter((row) => row.due > 0);

  const sum = (key) => data.reduce((acc, row) => acc + row[key], 0);

  return {
    meta: {
      from: from || null,
      to: to || null,
      count: data.length,
      totalDue: sum("due"),
      totalOpeningBalance: sum("openingBalance"),
      totalEndingBalance: sum("endingBalance"),
    },
    data,
  };
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getSalaryAdvanceReport,
  addPaymentFromDB,
};

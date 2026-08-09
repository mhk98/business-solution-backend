const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const sendSms = require("../../middlewares/sendSms");
const { ShifaAppointmentSerialSearchableFields } = require("./shifaAppointmentSerial.constants");

const ShifaAppointmentSerial = db.shifaAppointmentSerial;

const today = () => new Date().toISOString().slice(0, 10);

const normalizePayload = (payload = {}, { requireSerial = false } = {}) => {
  const name = String(payload.name || "").trim();
  const mobileNumber = String(payload.mobileNumber || payload.phone || "").trim();
  const appointmentDate = payload.appointmentDate || today();
  const note = String(payload.note || "").trim();
  const serialValue = payload.serial === "" || payload.serial === null || payload.serial === undefined
    ? null
    : Number(payload.serial);

  if (!name) throw new ApiError(400, "Name is required");
  if (!mobileNumber) throw new ApiError(400, "Mobile number is required");
  if (!appointmentDate) throw new ApiError(400, "Appointment date is required");
  if (serialValue !== null && (!Number.isInteger(serialValue) || serialValue < 1)) {
    throw new ApiError(400, "Serial must be a positive number");
  }
  if (requireSerial && serialValue === null) {
    throw new ApiError(400, "Serial is required");
  }

  return {
    name,
    mobileNumber,
    appointmentDate,
    note: note || null,
    serial: serialValue,
  };
};

const getNextSerial = async (appointmentDate, transaction) => {
  const maxSerial = await ShifaAppointmentSerial.max("serial", {
    where: { appointmentDate },
    transaction,
  });

  return Number(maxSerial || 0) + 1;
};

const buildSmsMessage = (row) =>
  `Dear ${row.name}, your Shifa appointment serial is ${row.serial} for ${row.appointmentDate}.`;

const markSmsResult = async (row, smsResult, transaction) => {
  await row.update(
    {
      smsStatus: smsResult ? "Sent" : "Not Sent",
      smsResponse: smsResult
        ? JSON.stringify({
            status: smsResult.status,
            statusText: smsResult.statusText,
            data: smsResult.data,
          }).slice(0, 5000)
        : null,
    },
    { transaction },
  );
};

const createSerial = async (payload, user) => {
  const normalized = normalizePayload(payload);
  const transaction = await db.sequelize.transaction();

  try {
    const serial = normalized.serial || await getNextSerial(normalized.appointmentDate, transaction);
    const duplicate = await ShifaAppointmentSerial.findOne({
      where: {
        appointmentDate: normalized.appointmentDate,
        serial,
      },
      transaction,
    });

    if (duplicate) {
      throw new ApiError(409, "This serial already exists for the appointment date");
    }

    const row = await ShifaAppointmentSerial.create(
      {
        ...normalized,
        serial,
        userId: user?.Id,
        smsStatus: "Pending",
      },
      { transaction },
    );

    try {
      const smsResult = await sendSms({
        to: row.mobileNumber,
        message: buildSmsMessage(row),
      });
      await markSmsResult(row, smsResult, transaction);
    } catch (error) {
      await row.update(
        {
          smsStatus: "Failed",
          smsResponse: String(error?.response?.data || error?.message || error).slice(0, 5000),
        },
        { transaction },
      );
    }

    await transaction.commit();
    return getDataById(row.Id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getWhereConditions = (filters = {}) => {
  const { searchTerm, startDate, endDate, ...filterData } = filters;
  const andConditions = [{ deletedAt: { [Op.is]: null } }];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ShifaAppointmentSerialSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (startDate || endDate) {
    andConditions.push({
      appointmentDate: {
        ...(startDate ? { [Op.gte]: startDate } : {}),
        ...(endDate ? { [Op.lte]: endDate } : {}),
      },
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });

  return { [Op.and]: andConditions };
};

const getAllSerials = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const whereConditions = getWhereConditions(filters);

  const data = await ShifaAppointmentSerial.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["appointmentDate", "DESC"], ["serial", "ASC"]],
  });

  const count = await ShifaAppointmentSerial.count({ where: whereConditions });
  return { meta: { count, page, limit }, data };
};

const getDataById = async (id) => {
  const result = await ShifaAppointmentSerial.findOne({ where: { Id: id } });
  if (!result) throw new ApiError(404, "Appointment serial not found");
  return result;
};

const updateSerial = async (id, payload) => {
  const existing = await getDataById(id);
  const normalized = normalizePayload(
    {
      name: payload.name ?? existing.name,
      mobileNumber: payload.mobileNumber ?? existing.mobileNumber,
      appointmentDate: payload.appointmentDate ?? existing.appointmentDate,
      note: payload.note ?? existing.note,
      serial: payload.serial ?? existing.serial,
    },
    { requireSerial: true },
  );

  const duplicate = await ShifaAppointmentSerial.findOne({
    where: {
      appointmentDate: normalized.appointmentDate,
      serial: normalized.serial,
      Id: { [Op.ne]: id },
    },
  });

  if (duplicate) {
    throw new ApiError(409, "This serial already exists for the appointment date");
  }

  await existing.update(normalized);
  return getDataById(id);
};

const deleteSerial = async (id) => {
  const existing = await getDataById(id);
  await existing.destroy();
  return { deleted: true };
};

module.exports = {
  createSerial,
  getAllSerials,
  getDataById,
  updateSerial,
  deleteSerial,
};

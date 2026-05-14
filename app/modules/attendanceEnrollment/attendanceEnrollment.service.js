const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  AttendanceEnrollmentSearchableFields,
} = require("./attendanceEnrollment.constants");

const AttendanceEnrollment = db.attendanceEnrollment;
const EmployeeList = db.employeeList;
const AttendanceDevice = db.attendanceDevice;

const enrollmentIncludes = [
  {
    model: EmployeeList,
    as: "employee",
    attributes: ["Id", "name", "employee_id", "employeeCode", "status"],
    required: false,
  },
  {
    model: AttendanceDevice,
    as: "device",
    attributes: ["Id", "name", "code", "model", "branch", "status"],
    required: false,
  },
];

const normalizeOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const sanitizeEnrollmentPayload = (payload = {}) => {
  const status = payload.status || "Active";

  return {
    employeeId: normalizeOptionalNumber(payload.employeeId),
    attendanceDeviceId: normalizeOptionalNumber(payload.attendanceDeviceId),
    deviceUserId: String(payload.deviceUserId || "").trim(),
    biometricModes: Array.isArray(payload.biometricModes)
      ? payload.biometricModes
      : String(payload.biometricModes || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    enrollmentStatus: payload.enrollmentStatus || "Enrolled",
    enrolledAt: payload.enrolledAt || new Date(),
    lastSyncedAt: payload.lastSyncedAt || null,
    note: status === "Approved" ? null : payload.note || null,
    status,
  };
};

const ensureReferences = async ({ employeeId, attendanceDeviceId, deviceUserId }, excludeId) => {
  if (!employeeId || !attendanceDeviceId || !deviceUserId) {
    throw new ApiError(400, "employeeId, attendanceDeviceId and deviceUserId are required");
  }

  const [employee, device] = await Promise.all([
    EmployeeList.findOne({ where: { Id: employeeId }, attributes: ["Id"] }),
    AttendanceDevice.findOne({ where: { Id: attendanceDeviceId }, attributes: ["Id"] }),
  ]);

  if (!employee) throw new ApiError(400, "Employee was not found");
  if (!device) throw new ApiError(400, "Attendance device was not found");

  const where = {
    attendanceDeviceId,
    deviceUserId,
  };

  if (excludeId) {
    where.Id = { [Op.ne]: excludeId };
  }

  const existing = await AttendanceEnrollment.findOne({ where, attributes: ["Id"] });
  if (existing) {
    throw new ApiError(409, "This device user is already enrolled on the selected device");
  }
};

const insertIntoDB = async (payload) => {
  const data = sanitizeEnrollmentPayload(payload);
  await ensureReferences(data);

  const result = await AttendanceEnrollment.create(data);
  return AttendanceEnrollment.findOne({
    where: { Id: result.Id },
    include: enrollmentIncludes,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: AttendanceEnrollmentSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const data = await AttendanceEnrollment.findAll({
    where: whereConditions,
    include: enrollmentIncludes,
    offset: skip,
    limit,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  const count = await AttendanceEnrollment.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () =>
  AttendanceEnrollment.findAll({
    include: enrollmentIncludes,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

const getDataById = async (id) =>
  AttendanceEnrollment.findOne({
    where: { Id: id },
    include: enrollmentIncludes,
  });

const updateOneFromDB = async (id, payload) => {
  const data = sanitizeEnrollmentPayload(payload);
  await ensureReferences(data, id);

  await AttendanceEnrollment.update(data, {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id) =>
  AttendanceEnrollment.destroy({
    where: { Id: id },
  });

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
};

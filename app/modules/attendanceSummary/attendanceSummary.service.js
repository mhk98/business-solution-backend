const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const AttendanceSummary = db.attendanceSummary;
const EmployeeList = db.employeeList;
const Shift = db.shift;

const summaryIncludes = [
  {
    model: EmployeeList,
    as: "employee",
    attributes: ["Id", "name", "employee_id", "employeeCode", "status"],
    required: false,
  },
  {
    model: Shift,
    as: "shift",
    attributes: ["Id", "name", "code", "startTime", "endTime"],
    required: false,
  },
];

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, from, to, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      "$employee.name$": { [Op.like]: `%${searchTerm.trim()}%` },
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });

  if (from && to) {
    andConditions.push({
      attendanceDate: {
        [Op.between]: [from, to],
      },
    });
  }

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const data = await AttendanceSummary.findAll({
    where: whereConditions,
    include: summaryIncludes,
    offset: skip,
    limit,
    paranoid: true,
    subQuery: false,
    order: [
      ["attendanceDate", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  const aggregateIncludes = searchTerm ? summaryIncludes : [];
  const [count, statusRows] = await Promise.all([
    AttendanceSummary.count({
      where: whereConditions,
      include: aggregateIncludes,
      distinct: true,
      col: "Id",
    }),
    AttendanceSummary.findAll({
      where: whereConditions,
      include: aggregateIncludes,
      attributes: [
        "attendanceStatus",
        [db.sequelize.fn("COUNT", db.sequelize.col("AttendanceSummary.Id")), "count"],
      ],
      group: ["attendanceStatus"],
      raw: true,
      subQuery: false,
    }),
  ]);

  const statusCounts = statusRows.reduce((acc, row) => {
    const key = row.attendanceStatus || "Unknown";
    acc[key] = Number(row.count || 0);
    return acc;
  }, {});

  return {
    meta: { count, page, limit, statusCounts },
    data,
  };
};

const getAllFromDBWithoutQuery = async () =>
  AttendanceSummary.findAll({
    include: summaryIncludes,
    paranoid: true,
    order: [
      ["attendanceDate", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

const getDataById = async (id) =>
  AttendanceSummary.findOne({
    where: { Id: id },
    include: summaryIncludes,
  });

const getMyAttendanceSummary = async (userId, limit = 10) => {
  const employee = await EmployeeList.findOne({
    where: { userId },
    attributes: ["Id"],
  });

  if (!employee) {
    throw new ApiError(404, "Employee profile was not found for this user");
  }

  return AttendanceSummary.findAll({
    where: { employeeId: employee.Id },
    include: summaryIncludes,
    paranoid: true,
    limit,
    order: [
      ["attendanceDate", "DESC"],
      ["createdAt", "DESC"],
    ],
  });
};

module.exports = {
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  getMyAttendanceSummary,
};

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const AttendanceRegularization = db.attendanceRegularization;
const EmployeeList = db.employeeList;
const User = db.user;

const regularizationIncludes = [
  {
    model: EmployeeList,
    as: "employee",
    attributes: ["Id", "name", "employee_id", "employeeCode", "status"],
    required: false,
  },
  {
    model: User,
    as: "requestedBy",
    attributes: ["Id", "FirstName", "LastName", "Email"],
    required: false,
  },
  {
    model: User,
    as: "approvedBy",
    attributes: ["Id", "FirstName", "LastName", "Email"],
    required: false,
  },
];

const insertIntoDB = async (payload) => {
  const result = await AttendanceRegularization.create(payload);
  return AttendanceRegularization.findOne({
    where: { Id: result.Id },
    include: regularizationIncludes,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: [
        { "$employee.name$": { [Op.like]: `%${searchTerm.trim()}%` } },
        { reason: { [Op.like]: `%${searchTerm.trim()}%` } },
      ],
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

  const data = await AttendanceRegularization.findAll({
    where: whereConditions,
    include: regularizationIncludes,
    offset: skip,
    limit,
    paranoid: true,
    subQuery: false,
    order: [
      ["attendanceDate", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  const count = await AttendanceRegularization.count({
    where: whereConditions,
    include: searchTerm ? regularizationIncludes : [],
    distinct: true,
    col: "Id",
  });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () =>
  AttendanceRegularization.findAll({
    include: regularizationIncludes,
    paranoid: true,
    order: [
      ["attendanceDate", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

const getDataById = async (id) =>
  AttendanceRegularization.findOne({
    where: { Id: id },
    include: regularizationIncludes,
  });

const updateOneFromDB = async (id, payload) => {
  await AttendanceRegularization.update(payload, {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id) =>
  AttendanceRegularization.destroy({
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

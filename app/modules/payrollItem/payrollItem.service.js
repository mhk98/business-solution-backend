const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const PayrollItem = db.payrollItem;
const PayrollRun = db.payrollRun;
const EmployeeList = db.employeeList;

const includes = [
  { model: PayrollRun, as: "payrollRun", attributes: ["Id", "month", "title", "status"], required: false },
  { model: EmployeeList, as: "employee", attributes: ["Id", "name", "employee_id", "employeeCode"], required: false },
];

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, month, ...otherFilters } = filters;
  const andConditions = [];
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: [
        { "$employee.name$": { [Op.like]: `%${searchTerm.trim()}%` } },
        { "$payrollRun.month$": { [Op.like]: `%${searchTerm.trim()}%` } },
      ],
    });
  }
  if (month) {
    andConditions.push({ "$payrollRun.month$": { [Op.eq]: month } });
  }
  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });
  andConditions.push({ deletedAt: { [Op.is]: null } });
  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const data = await PayrollItem.findAll({
    where,
    include: includes,
    offset: skip,
    limit,
    paranoid: true,
    subQuery: false,
    order: [["createdAt", "DESC"]],
  });
  const count = await PayrollItem.count({
    where,
    include: searchTerm || month ? includes : [],
    distinct: true,
    col: "Id",
  });
  return { meta: { count, page, limit }, data };
};

const getDataById = async (id) => PayrollItem.findOne({ where: { Id: id }, include: includes });
const getAllFromDBWithoutQuery = async () => PayrollItem.findAll({ include: includes, paranoid: true, order: [["createdAt", "DESC"]] });
const getMyPayrollItems = async (userId, limit = 10) => {
  const employee = await EmployeeList.findOne({
    where: { userId },
    attributes: ["Id"],
  });

  if (!employee) {
    throw new ApiError(404, "Employee profile was not found for this user");
  }

  return PayrollItem.findAll({
    where: { employeeId: employee.Id },
    include: includes,
    paranoid: true,
    limit,
    order: [["createdAt", "DESC"]],
  });
};

module.exports = {
  getAllFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getMyPayrollItems,
};

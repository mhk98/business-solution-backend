const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const LeaveType = db.leaveType;

const insertIntoDB = async (data) => LeaveType.create(data);

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: [
        { name: { [Op.like]: `%${searchTerm.trim()}%` } },
        { code: { [Op.like]: `%${searchTerm.trim()}%` } },
      ],
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });

  andConditions.push({ deletedAt: { [Op.is]: null } });
  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  const data = await LeaveType.findAll({
    where,
    offset: skip,
    limit,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  const count = await LeaveType.count({ where });

  return { meta: { count, page, limit }, data };
};

const getAllFromDBWithoutQuery = async () =>
  LeaveType.findAll({ paranoid: true, order: [["createdAt", "DESC"]] });

const getDataById = async (id) => LeaveType.findOne({ where: { Id: id } });

const updateOneFromDB = async (id, payload) => {
  await LeaveType.update(payload, { where: { Id: id } });
  return getDataById(id);
};

const deleteIdFromDB = async (id) => LeaveType.destroy({ where: { Id: id } });

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
};

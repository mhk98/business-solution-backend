const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const BankAccount = db.bankAccount;

const insertIntoDB = async (data) => {
  const result = await BankAccount.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      [Op.or]: [
        { bankName: { [Op.like]: `%${searchTerm}%` } },
        { accountNumber: { [Op.like]: `%${searchTerm}%` } },
      ],
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      [Op.and]: Object.entries(filterData).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await BankAccount.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await BankAccount.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await BankAccount.findOne({
    where: { Id: id },
  });
  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await BankAccount.destroy({
    where: { Id: id },
  });
  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await BankAccount.update(payload, {
    where: { Id: id },
  });
  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await BankAccount.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return result;
};

const BankAccountService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = BankAccountService;

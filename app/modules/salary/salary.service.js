const db = require("../../../models");
const Salary = db.salary;

const insertIntoDB = async (data) => {
  const result = await Salary.create(data);
  return result;
};

const getAllFromDB = async () => {
  const result = await Salary.findOne({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result; // এটা array
};

const getDataById = async (id) => {
  const result = await Salary.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Salary.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await Salary.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Salary.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const SalaryService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = SalaryService;

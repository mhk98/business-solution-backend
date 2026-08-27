const db = require("../../../models");
const CompanyInfo = db.companyInfo;

const insertIntoDB = async (data) => {
  const result = await CompanyInfo.create(data);
  return result;
};

const getAllFromDB = async () => {
  const result = await CompanyInfo.findOne({
    where: {},
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const getDataById = async (id) => {
  const result = await CompanyInfo.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await CompanyInfo.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await CompanyInfo.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await CompanyInfo.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const CompanyInfoService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = CompanyInfoService;

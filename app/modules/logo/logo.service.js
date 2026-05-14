const db = require("../../../models");
const Logo = db.logo;

const insertIntoDB = async (data) => {
  const result = await Logo.create(data);
  return result;
};

const getAllFromDB = async () => {
  const result = await Logo.findOne({
    where: {}, // দরকার হলে শর্ত দিন
    paranoid: true, // soft deleted বাদ
    order: [["createdAt", "DESC"]], // latest
  });

  return result;
};

const getDataById = async (id) => {
  const result = await Logo.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Logo.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await Logo.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Logo.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const LogoService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = LogoService;

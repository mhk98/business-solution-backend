const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const Asset = db.asset;

const normalizeName = (name) => String(name || "").trim();

const ensureValidName = (name) => {
  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    throw new ApiError(400, "Asset name is required");
  }

  return normalizedName;
};

const insertIntoDB = async (payload) => {
  const name = ensureValidName(payload.name);
  const result = await Asset.create({ name });
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, name } = filters;

  const andConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    andConditions.push({
      name: { [Op.like]: `%${String(searchTerm).trim()}%` },
    });
  }

  if (name && String(name).trim()) {
    andConditions.push({
      name: { [Op.eq]: String(name).trim() },
    });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Asset.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Asset.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Asset.findOne({
    where: {
      Id: id,
    },
  });

  if (!result) {
    throw new ApiError(404, "Asset not found");
  }

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const data = {};

  if (payload.name !== undefined) {
    data.name = ensureValidName(payload.name);
  }

  if (!Object.keys(data).length) {
    throw new ApiError(400, "Asset name is required");
  }

  const [updatedCount] = await Asset.update(data, {
    where: {
      Id: id,
    },
  });

  if (!updatedCount) {
    throw new ApiError(404, "Asset not found");
  }

  return updatedCount;
};

const deleteIdFromDB = async (id) => {
  const result = await Asset.destroy({
    where: {
      Id: id,
    },
  });

  if (!result) {
    throw new ApiError(404, "Asset not found");
  }

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Asset.findAll({
    paranoid: true,
    order: [["name", "ASC"]],
  });

  return result;
};

const AssetService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = AssetService;

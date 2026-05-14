const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const AssetsStock = db.assetsStock;

const n = (value) => Number(value || 0);

const buildDateWhere = (startDate, endDate) => {
  if (!startDate && !endDate) return {};

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return {
      createdAt: { [Op.between]: [start, end] },
    };
  }

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    return {
      createdAt: { [Op.gte]: start },
    };
  }

  return {
    createdAt: { [Op.lte]: new Date(new Date(endDate).setHours(23, 59, 59, 999)) },
  };
};

const buildWhere = (filters = {}) => {
  const { name, startDate, endDate } = filters;

  return {
    deletedAt: { [Op.is]: null },
    ...buildDateWhere(startDate, endDate),
    ...(name
      ? {
          name: {
            [Op.like]: `%${String(name).trim()}%`,
          },
        }
      : {}),
  };
};

const mapRow = (row) => ({
  Id: row.Id,
  name: row.name,
  quantity: n(row.quantity),
  price: n(row.price),
  total: n(row.quantity) * n(row.price),
  date: row.updatedAt ? new Date(row.updatedAt).toISOString().slice(0, 10) : null,
  status: "Active",
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const getAllFromDB = async (filters = {}, options = {}) => {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.max(1, Number(options.limit || 10));
  const skip = (page - 1) * limit;
  const where = buildWhere(filters);

  const { rows, count } = await AssetsStock.findAndCountAll({
    where,
    offset: skip,
    limit,
    order: [
      ["name", "ASC"],
      ["Id", "DESC"],
    ],
  });

  const totalQuantity = n(
    await AssetsStock.sum("quantity", {
      where,
    }),
  );

  return {
    meta: {
      page,
      limit,
      count,
      totalQuantity,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    },
    data: rows.map(mapRow),
  };
};

const getAllFromDBWithoutQuery = async () => {
  const rows = await AssetsStock.findAll({
    where: buildWhere({}),
    order: [
      ["name", "ASC"],
      ["Id", "DESC"],
    ],
  });

  return rows.map(mapRow);
};

module.exports = {
  getAllFromDB,
  getAllFromDBWithoutQuery,
};

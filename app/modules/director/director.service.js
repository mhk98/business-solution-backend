const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const Director = db.director;
const DirectorProfitShare = db.directorProfitShare;

const normalizeAmount = (value) => Number(value || 0);

const addBalancesToDirectors = async (directors) => {
  const plainDirectors = directors.map((director) =>
    director.get ? director.get({ plain: true }) : director,
  );
  const directorIds = plainDirectors
    .map((director) => director.Id)
    .filter(Boolean);

  if (!directorIds.length) return plainDirectors;

  const rows = await DirectorProfitShare.findAll({
    attributes: [
      "directorId",
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal(
            "CASE WHEN type = 'Invest' THEN amount ELSE 0 END",
          ),
        ),
        "totalInvest",
      ],
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal(
            "CASE WHEN type = 'Profit' THEN amount ELSE 0 END",
          ),
        ),
        "totalProfit",
      ],
      [db.Sequelize.fn("MAX", db.Sequelize.col("date")), "lastDate"],
    ],
    where: {
      directorId: { [Op.in]: directorIds },
    },
    group: ["directorId"],
    raw: true,
  });

  const balanceMap = rows.reduce((acc, row) => {
    const totalInvest = normalizeAmount(row.totalInvest);
    const totalProfit = normalizeAmount(row.totalProfit);
    acc[row.directorId] = {
      totalInvest,
      totalProfit,
      netBalance: totalInvest - totalProfit,
      lastDate: row.lastDate,
    };
    return acc;
  }, {});

  return plainDirectors.map((director) => ({
    ...director,
    totalInvest: balanceMap[director.Id]?.totalInvest || 0,
    totalProfit: balanceMap[director.Id]?.totalProfit || 0,
    netBalance: balanceMap[director.Id]?.netBalance || 0,
    lastDate: balanceMap[director.Id]?.lastDate || null,
  }));
};

const insertIntoDB = async (payload) =>
  Director.create({
    name: String(payload.name || "").trim(),
    note: payload.note || null,
    status: payload.status || "Active",
  });

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    andConditions.push({
      name: { [Op.like]: `${String(searchTerm).trim()}%` },
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  const [rows, count, allRows] = await Promise.all([
    Director.findAll({
      where,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    Director.count({ where }),
    Director.findAll({ where, paranoid: true }),
  ]);

  const allDirectorsWithBalances = await addBalancesToDirectors(allRows);
  const totalInvest = allDirectorsWithBalances.reduce(
    (sum, director) => sum + normalizeAmount(director.totalInvest),
    0,
  );
  const totalProfit = allDirectorsWithBalances.reduce(
    (sum, director) => sum + normalizeAmount(director.totalProfit),
    0,
  );

  return {
    meta: {
      count,
      page,
      limit,
      totalInvest,
      totalProfit,
      netBalance: totalInvest - totalProfit,
    },
    data: await addBalancesToDirectors(rows),
  };
};

const getDataById = async (id) => Director.findOne({ where: { Id: id } });

const updateOneFromDB = async (id, payload) =>
  Director.update(
    {
      name: String(payload.name || "").trim(),
      note: payload.note || null,
      status: payload.status || "Active",
    },
    { where: { Id: id } },
  );

const deleteIdFromDB = async (id) => Director.destroy({ where: { Id: id } });

const getAllFromDBWithoutQuery = async () => {
  const rows = await Director.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return addBalancesToDirectors(rows);
};

const getDirectorInvestmentReport = async () => {
  const directors = await Director.findAll({
    paranoid: true,
    order: [["name", "ASC"]],
  });
  const directorsWithBalances = await addBalancesToDirectors(directors);
  const data = directorsWithBalances
    .map((director) => ({
      directorId: director.Id,
      name: director.name || "Unknown Director",
      investAmount: normalizeAmount(director.totalInvest),
    }))
    .filter((row) => row.investAmount > 0)
    .sort((a, b) => b.investAmount - a.investAmount);
  const totalInvestAmount = data.reduce(
    (sum, row) => sum + row.investAmount,
    0,
  );

  return {
    meta: { count: data.length, totalInvestAmount },
    data,
  };
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getDirectorInvestmentReport,
};

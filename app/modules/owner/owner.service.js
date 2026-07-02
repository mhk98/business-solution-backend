const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");

const Owner = db.owner;
const OwnerTransaction = db.ownerTransaction;

const normalizeAmount = (value) => Number(value || 0);

const addBalancesToOwners = async (owners) => {
  const plainOwners = owners.map((owner) =>
    owner.get ? owner.get({ plain: true }) : owner,
  );
  const ownerIds = plainOwners.map((owner) => owner.Id).filter(Boolean);

  if (!ownerIds.length) return plainOwners;

  const rows = await OwnerTransaction.findAll({
    attributes: [
      "ownerId",
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal(
            "CASE WHEN type = 'Deposit' THEN amount ELSE 0 END",
          ),
        ),
        "totalDeposit",
      ],
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal(
            "CASE WHEN type = 'Withdraw' THEN amount ELSE 0 END",
          ),
        ),
        "totalWithdraw",
      ],
      [db.Sequelize.fn("MAX", db.Sequelize.col("date")), "lastDate"],
    ],
    where: {
      ownerId: { [Op.in]: ownerIds },
    },
    group: ["ownerId"],
    raw: true,
  });

  const balanceMap = rows.reduce((acc, row) => {
    const totalDeposit = normalizeAmount(row.totalDeposit);
    const totalWithdraw = normalizeAmount(row.totalWithdraw);
    acc[row.ownerId] = {
      totalDeposit,
      totalWithdraw,
      netBalance: totalDeposit - totalWithdraw,
      lastDate: row.lastDate,
    };
    return acc;
  }, {});

  return plainOwners.map((owner) => ({
    ...owner,
    totalDeposit: balanceMap[owner.Id]?.totalDeposit || 0,
    totalWithdraw: balanceMap[owner.Id]?.totalWithdraw || 0,
    netBalance: balanceMap[owner.Id]?.netBalance || 0,
    lastDate: balanceMap[owner.Id]?.lastDate || null,
  }));
};

const insertIntoDB = async (payload) =>
  Owner.create({
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
    Owner.findAll({
      where,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    Owner.count({ where }),
    Owner.findAll({ where, paranoid: true }),
  ]);
  const allOwnersWithBalances = await addBalancesToOwners(allRows);
  const totalDeposit = allOwnersWithBalances.reduce(
    (sum, owner) => sum + normalizeAmount(owner.totalDeposit),
    0,
  );
  const totalWithdraw = allOwnersWithBalances.reduce(
    (sum, owner) => sum + normalizeAmount(owner.totalWithdraw),
    0,
  );

  return {
    meta: {
      count,
      page,
      limit,
      totalDeposit,
      totalWithdraw,
      netBalance: totalDeposit - totalWithdraw,
    },
    data: await addBalancesToOwners(rows),
  };
};

const getDataById = async (id) => Owner.findOne({ where: { Id: id } });

const updateOneFromDB = async (id, payload) =>
  Owner.update(
    {
      name: String(payload.name || "").trim(),
      note: payload.note || null,
      status: payload.status || "Active",
    },
    { where: { Id: id } },
  );

const deleteIdFromDB = async (id) => Owner.destroy({ where: { Id: id } });

const getAllFromDBWithoutQuery = async () => {
  const rows = await Owner.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return addBalancesToOwners(rows);
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

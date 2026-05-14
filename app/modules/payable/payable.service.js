const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { PayableSearchableFields } = require("./payable.constants");
const Payable = db.payable;
const Supplier = db.supplier;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (data) => {
  const result = await Payable.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, name, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (MySQL/MariaDB): LIKE
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    andConditions.push({
      [Op.or]: (PayableSearchableFields || []).map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  // ✅ Optional direct name filter (also LIKE)
  if (name && String(name).trim()) {
    const term = String(name).trim();
    andConditions.push({
      name: { [Op.like]: `%${term}%` },
    });
  }

  // ✅ Date range filter on createdAt
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // include full end day

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  } else if (startDate) {
    const start = new Date(startDate);
    andConditions.push({
      createdAt: { [Op.gte]: start },
    });
  } else if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({
      createdAt: { [Op.lte]: end },
    });
  }

  // ✅ Other exact filters (eq)
  if (Object.keys(otherFilters).length) {
    Object.entries(otherFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        andConditions.push({ [key]: { [Op.eq]: value } });
      }
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, String(options.sortOrder).toUpperCase()]]
      : [["createdAt", "DESC"]];

  const data = await Payable.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["Id", "name"],
      },
    ],
    paranoid: true,
    order,
  });

  // const total = await Payable.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalAmount] = await Promise.all([
    Payable.count({ where: whereConditions }),
    Payable.sum("amount", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalAmount: totalAmount || 0, page, limit },
    data,
  };
};

module.exports = {
  getAllFromDB,
};

const getDataById = async (id) => {
  const result = await Payable.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Payable.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { status, note, userId } = payload;
  const [updatedCount] = await Payable.update(payload, {
    where: {
      Id: id,
    },
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "accountant"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message =
    status === "Approved"
      ? "Petty cash request approved"
      : note || "Petty cash updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/payable`,
      }),
    ),
  );
  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Payable.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const PayableService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PayableService;

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const ensureUniqueName = require("../../../shared/ensureUniqueName");
const Category = db.category;

const normalizeStatus = (value) => {
  const status = String(value || "Expense").trim();
  if (!status || status === "Active") return "Expense";
  if (!["Expense", "Not Expense"].includes(status)) {
    throw new ApiError(400, "Category status must be Expense or Not Expense");
  }
  return status;
};

const normalizePayload = (payload = {}, { defaultStatus = false } = {}) => {
  const normalized = { ...payload };

  if (payload.name !== undefined) {
    normalized.name = String(payload.name || "").trim();
    if (!normalized.name) throw new ApiError(400, "Category name is required");
  }

  if (payload.status !== undefined || defaultStatus) {
    normalized.status = normalizeStatus(payload.status);
  }

  return normalized;
};

const insertIntoDB = async (data) => {
  const payload = normalizePayload(data, { defaultStatus: true });
  if (!payload.name) throw new ApiError(400, "Category name is required");
  await ensureUniqueName(Category, payload.name, { label: "Category" });
  const result = await Category.create(payload);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  console.log(filters);

  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  // if (searchTerm && searchTerm.trim()) {
  //   andConditions.push({
  //     [Op.or]: CategorySearchableFields.map((field) => ({
  //       [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
  //     })),
  //   });
  // }

  // // ✅ Exact filters (e.g. name)
  // if (Object.keys(otherFilters).length) {
  //   andConditions.push(
  //     ...Object.entries(otherFilters).map(([key, value]) => ({
  //       [key]: { [Op.eq]: value },
  //     }))
  //   );
  // }

  // Match `title` starting from the search term
  if (searchTerm) {
    andConditions.push({
      name: { [Op.like]: `${searchTerm}%` },
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

  const result = await Category.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Category.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Category.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Category.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const category = await Category.findByPk(id);
  if (!category) throw new ApiError(404, "Category not found");

  const normalized = normalizePayload(payload);
  await ensureUniqueName(Category, normalized.name, {
    excludeId: id,
    label: "Category",
  });

  await category.update(normalized);
  await category.reload();

  return category;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Category.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const CategoryService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = CategoryService;

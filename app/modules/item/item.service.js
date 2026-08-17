const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ItemSearchableFields } = require("./item.constants");
const Item = db.item;
const ItemMaster = db.itemMaster;
const Manufacture = db.manufacture;
const ManufactureStock = db.manufactureStock;
const ManufactureProduction = db.manufactureProduction;
const ItemRequisition = db.itemRequisition;
const StockAdjustment = db.stockAdjustment;
const StockMovement = db.stockMovement;

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === "";

const buildItemRenameWhere = (itemId, previousName) => {
  const conditions = [{ itemId: Number(itemId) }];
  if (!isBlank(previousName)) {
    conditions.push({ name: String(previousName).trim() });
  }

  return { [Op.or]: conditions };
};

const syncItemNameReferences = async ({
  itemId,
  previousName,
  nextName,
  transaction,
}) => {
  if (isBlank(nextName) || String(previousName || "").trim() === String(nextName).trim()) {
    return;
  }

  const whereConditions = buildItemRenameWhere(itemId, previousName);
  const renameOptions = { where: whereConditions, transaction };

  await Promise.all([
    ItemMaster.update({ name: nextName }, renameOptions),
    Manufacture.update({ name: nextName }, renameOptions),
    ManufactureStock.update({ name: nextName }, renameOptions),
    ManufactureProduction.update({ name: nextName }, renameOptions),
    ItemRequisition.update({ name: nextName }, renameOptions),
    StockAdjustment.update({ name: nextName }, renameOptions),
    StockMovement.update(
      { name: nextName },
      { ...renameOptions, hooks: false },
    ),
  ]);
};

const insertIntoDB = async (data) => {
  const { name } = data;

  const payload = {
    name,
  };
  console.log("data", data);
  const result = await Item.create(payload);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ItemSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Item.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Item.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Item.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Item.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { name } = payload;

  const data = {
    name,
  };

  const result = await db.sequelize.transaction(async (transaction) => {
    const existing = await Item.findOne({
      where: { Id: id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!existing) {
      throw new ApiError(404, "Item not found");
    }

    const [updatedCount] = await Item.update(data, {
      where: {
        Id: id,
      },
      transaction,
    });

    await syncItemNameReferences({
      itemId: id,
      previousName: existing.name,
      nextName: name,
      transaction,
    });

    return [updatedCount];
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Item.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const ItemService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ItemService;

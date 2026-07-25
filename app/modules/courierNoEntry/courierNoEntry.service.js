const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  CourierNoEntrySearchableFields,
} = require("./courierNoEntry.constants");
const mergeVariants = require("../../../shared/mergeVariants");
const {
  buildSyncedInventoryStockPayload,
} = require("../../../shared/variantQuantity");

const CourierNoEntry = db.courierNoEntry;
const InventoryMaster = db.inventoryMaster;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const COURIER_STATUS_ON_THE_WAY = "On the way";
const COURIER_STATUS_RECEIVED = "Received";

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getBulkItems = (payload = {}) => parseJsonArray(payload.items);

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const normalizeCourierStatus = (value) => {
  const status = String(value || "").trim().toLowerCase();
  if (status === "received") return COURIER_STATUS_RECEIVED;
  return COURIER_STATUS_ON_THE_WAY;
};

const isReceivedStatus = (value) =>
  normalizeCourierStatus(value) === COURIER_STATUS_RECEIVED;

const getProductReferenceId = (payload = {}) =>
  Number(payload.receivedId || payload.productId || 0);

const getInventoryProduct = async (payload = {}) => {
  const productId = getProductReferenceId(payload);
  if (!productId) throw new ApiError(400, "Product is required");

  const inventory = await InventoryMaster.findOne({ where: { Id: productId } });
  if (!inventory) throw new ApiError(404, "Product not found in inventory");

  return inventory;
};

const normalizeQuantity = (payload = {}) => {
  const quantity = Number(payload.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }
  return quantity;
};

const normalizeCourierPayload = async (payload = {}, globalPayload = {}) => {
  const inventory = await getInventoryProduct(payload);
  const quantity = normalizeQuantity(payload);
  const purchasePrice = Number(payload.purchase_price || 0);
  const salePrice = Number(payload.sale_price || 0);
  const status = String(payload.status ?? globalPayload.status ?? "").trim();
  const courierStatus = normalizeCourierStatus(
    payload.courierStatus ?? globalPayload.courierStatus,
  );

  return {
    name: inventory.name,
    supplierId: payload.supplierId ?? globalPayload.supplierId ?? null,
    warehouseId: payload.warehouseId ?? globalPayload.warehouseId ?? null,
    courierNo: payload.courierNo ?? globalPayload.courierNo ?? null,
    quantity,
    variants: parseJsonArray(payload.variants),
    items: [],
    source: "Courier No Entry",
    batchId: payload.batchId ?? globalPayload.batchId ?? null,
    purchase_price: Number.isFinite(purchasePrice) ? purchasePrice : 0,
    sale_price: Number.isFinite(salePrice) ? salePrice : 0,
    productId: inventory.Id,
    status: status || "Active",
    courierStatus,
    note: payload.note ?? globalPayload.note ?? null,
    date: payload.date ?? globalPayload.date ?? new Date(),
  };
};

const addCourierEntryToInventoryStock = async (row, transaction) => {
  if (!row?.productId) throw new ApiError(400, "Product is required");

  const inventory = await InventoryMaster.findOne({
    where: { Id: row.productId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (!inventory) throw new ApiError(404, "Product not found in inventory");

  const variants = parseJsonArray(row.variants);
  const quantity = toNumber(row.quantity);

  await inventory.update(
    buildSyncedInventoryStockPayload({
      quantity: toNumber(inventory.quantity) + quantity,
      variants: variants.length
        ? mergeVariants(inventory.variants, variants)
        : inventory.variants,
    }),
    { transaction },
  );
};

const insertIntoDB = async (payload = {}) => {
  const items = getBulkItems(payload);

  if (items.length) {
    const rows = [];
    for (const item of items) {
      rows.push(await normalizeCourierPayload(item, payload));
    }
    return db.sequelize.transaction(async (t) => {
      const createdRows = await CourierNoEntry.bulkCreate(rows, {
        transaction: t,
      });
      for (const row of createdRows) {
        if (isReceivedStatus(row.courierStatus)) {
          await addCourierEntryToInventoryStock(row, t);
        }
      }
      return createdRows;
    });
  }

  const data = await normalizeCourierPayload(payload);
  return db.sequelize.transaction(async (t) => {
    const created = await CourierNoEntry.create(data, { transaction: t });
    if (isReceivedStatus(created.courierStatus)) {
      await addCourierEntryToInventoryStock(created, t);
    }
    return created;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, courierStatus, ...otherFilters } =
    filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: CourierNoEntrySearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => ({ [key]: { [Op.eq]: value } })),
    );
  }

  if (courierStatus) {
    andConditions.push({ courierStatus: { [Op.eq]: courierStatus } });
  } else {
    andConditions.push({
      [Op.or]: [
        { courierStatus: { [Op.ne]: COURIER_STATUS_RECEIVED } },
        { courierStatus: { [Op.is]: null } },
      ],
    });
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({ date: { [Op.between]: [start, end] } });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count, totalQuantity] = await Promise.all([
    CourierNoEntry.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      include: [
        {
          model: Supplier,
          as: "supplier",
          attributes: ["Id", "name"],
        },
        {
          model: Warehouse,
          as: "warehouse",
          attributes: ["Id", "name"],
        },
        {
          model: InventoryMaster,
          attributes: ["Id", "name", "sale_price"],
        },
      ],
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    CourierNoEntry.count({ where: whereConditions }),
    CourierNoEntry.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  return CourierNoEntry.findOne({ where: { Id: id } });
};

const updateOneFromDB = async (id, payload = {}) => {
  const incomingBulkItems = getBulkItems(payload);

  if (incomingBulkItems.length) {
    const existing = await CourierNoEntry.findOne({ where: { Id: id } });
    if (!existing) return 0;

    const rows = [];
    for (const item of incomingBulkItems) {
      rows.push(await normalizeCourierPayload(item, payload));
    }

    return db.sequelize.transaction(async (t) => {
      await CourierNoEntry.destroy({ where: { Id: id }, transaction: t });
      const createdRows = await CourierNoEntry.bulkCreate(
        rows.map((row) => ({
          ...row,
          batchId: existing.batchId || row.batchId || `batch-${Date.now()}`,
        })),
        { transaction: t },
      );
      if (!isReceivedStatus(existing.courierStatus)) {
        for (const row of createdRows) {
          if (isReceivedStatus(row.courierStatus)) {
            await addCourierEntryToInventoryStock(row, t);
          }
        }
      }
      return rows.length;
    });
  }

  const data = await normalizeCourierPayload(payload);
  return db.sequelize.transaction(async (t) => {
    const existing = await CourierNoEntry.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!existing) return 0;

    const [updatedCount] = await CourierNoEntry.update(data, {
      where: { Id: id },
      transaction: t,
    });

    if (
      !isReceivedStatus(existing.courierStatus) &&
      isReceivedStatus(data.courierStatus)
    ) {
      await addCourierEntryToInventoryStock(data, t);
    }

    return updatedCount;
  });
};

const deleteIdFromDB = async (id) => {
  return CourierNoEntry.destroy({ where: { Id: id } });
};

const getAllFromDBWithoutQuery = async () => {
  return CourierNoEntry.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
  toNumber,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  PackagingItemPurchaseSearchableFields,
} = require("./packagingItemPurchase.constants");

const PackagingItemPurchase = db.packagingItemPurchase;
const PackagingItemStock = db.packagingItemStock;
const PackagingItem = db.packagingItem;
const Supplier = db.supplier;
const SupplierHistory = db.supplierHistory;

const makeBatchId = () =>
  `PIP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseItems = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getPayloadItems = (payload = {}) => {
  const items = parseItems(payload.items);
  if (items.length) return items;

  return [
    {
      packagingItemId: payload.packagingItemId,
      unit: payload.unit,
      unitValue: payload.unitValue,
      unitCost: payload.unitCost,
      cost: payload.cost,
      totalCost: payload.totalCost,
    },
  ];
};

const resolveLineCost = (item, inputUnitValue) => {
  const unitCost = toNumber(item.unitCost ?? item.costPerUnit);

  if (unitCost > 0) {
    return {
      unitCost,
      cost: unitCost * inputUnitValue,
    };
  }

  const cost = toNumber(item.totalCost ?? item.cost);
  return {
    unitCost: inputUnitValue > 0 ? cost / inputUnitValue : 0,
    cost,
  };
};

const normalizePurchaseItems = async (payload = {}) => {
  const rawItems = getPayloadItems(payload);
  const normalizedItems = [];
  const othersCost = Math.max(0, toNumber(payload.othersCost));

  for (const item of rawItems) {
    const packagingItemId = item.packagingItemId;
    const packagingItem = await PackagingItem.findOne({
      where: { Id: packagingItemId },
    });
    if (!packagingItem) throw new ApiError(404, "Packaging item not found");

    const normalizedPayload = toBaseStockPayload(item.unit, item.unitValue);
    const totalUnitValue = normalizedPayload.unitValue;

    if (totalUnitValue <= 0) {
      throw new ApiError(400, "unitValue must be greater than 0");
    }

    const costPayload = resolveLineCost(item, normalizedPayload.inputUnitValue);

    normalizedItems.push({
      packagingItemId,
      name: packagingItem.name,
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      unitCost: costPayload.unitCost,
      cost: costPayload.cost,
    });
  }

  const itemTotalCost = normalizedItems.reduce(
    (total, item) => total + toNumber(item.cost),
    0,
  );
  const allPackagingItemCost = itemTotalCost + othersCost;

  return { normalizedItems, allPackagingItemCost, itemTotalCost, othersCost };
};

const updateSupplierHistoryAmount = async ({
  supplierHistoryId,
  amountDelta,
  supplierId,
  date,
  note,
  transaction,
}) => {
  if (!supplierHistoryId) return null;

  const supplierHistory = await SupplierHistory.findOne({
    where: { Id: supplierHistoryId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!supplierHistory) return;

  const nextAmount = Math.max(
    0,
    toNumber(supplierHistory.amount) + toNumber(amountDelta),
  );

  if (nextAmount <= 0) {
    await supplierHistory.destroy({ transaction });
    return;
  }

  await supplierHistory.update(
    {
      amount: nextAmount,
      supplierId:
        supplierId === undefined ? supplierHistory.supplierId : supplierId,
      date: date || supplierHistory.date,
      note: note ?? supplierHistory.note,
    },
    { transaction },
  );

  return supplierHistory;
};

const adjustStockBalance = async ({
  packagingItemId,
  name,
  unit,
  cost,
  delta,
  transaction,
  createOnPositive = false,
}) => {
  if (!delta) return null;

  const stockRow = await PackagingItemStock.findOne({
    where: { packagingItemId },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["createdAt", "ASC"]],
  });

  if (!stockRow) {
    if (createOnPositive && delta > 0) {
      return PackagingItemStock.create(
        {
          packagingItemId,
          name,
          unit,
          unitValue: delta,
          cost: toNumber(cost),
        },
        { transaction },
      );
    }

    throw new ApiError(404, "Packaging item stock not found");
  }

  const currentPayload = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
  const nextQuantity = currentPayload.unitValue + delta;

  if (nextQuantity < 0) {
    throw new ApiError(400, "Packaging item stock cannot be negative");
  }

  const currentCost = toNumber(stockRow.cost);
  const currentUnitCost =
    currentPayload.unitValue > 0 ? currentCost / currentPayload.unitValue : 0;
  const nextCost =
    delta > 0
      ? currentCost + toNumber(cost)
      : Math.max(0, currentCost + delta * currentUnitCost);

  return stockRow.update(
    {
      packagingItemId,
      name,
      unit: currentPayload.isConvertedUnit ? currentPayload.unit : unit,
      unitValue: nextQuantity,
      cost: nextCost,
    },
    { transaction },
  );
};

const insertIntoDB = async (payload) => {
  const { bookId, date, file, note, status, supplierId } = payload;
  const { normalizedItems, allPackagingItemCost, othersCost } =
    await normalizePurchaseItems(payload);

  return db.sequelize.transaction(async (t) => {
    const batchId = payload.batchId || makeBatchId();
    let supplierHistoryId = null;

    if (supplierId && allPackagingItemCost > 0) {
      const supplierHistory = await SupplierHistory.create(
        {
          supplierId,
          bookId: bookId || null,
          amount: allPackagingItemCost,
          status: "Unpaid",
          date: date || new Date(),
          file: file || null,
          note:
            note ||
            `Packaging item purchase: ${normalizedItems
              .map((item) => item.name)
              .join(", ")}`,
        },
        { transaction: t },
      );
      supplierHistoryId = supplierHistory.Id;
    }

    const purchases = [];

    for (const item of normalizedItems) {
      const purchase = await PackagingItemPurchase.create(
        {
          packagingItemId: item.packagingItemId,
          supplierId: supplierId || null,
          name: item.name,
          unit: item.unit,
          unitValue: item.unitValue,
          unitCost: item.unitCost,
          cost: item.cost,
          allPackagingItemCost,
          othersCost,
          batchId,
          supplierHistoryId,
          date,
          note: note || null,
          status: String(status || "").trim() || "Active",
        },
        { transaction: t },
      );

      await adjustStockBalance({
        packagingItemId: item.packagingItemId,
        name: item.name,
        unit: item.unit,
        cost: item.cost,
        delta: item.unitValue,
        transaction: t,
        createOnPositive: true,
      });

      purchases.push(purchase);
    }

    return {
      batchId,
      allPackagingItemCost,
      othersCost,
      supplierHistoryId,
      items: purchases,
    };
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingItemPurchaseSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => ({
          [key]: { [Op.eq]: value },
        })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({ date: { [Op.between]: [start, end] } });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count] = await Promise.all([
    PackagingItemPurchase.findAll({
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
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingItemPurchase.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const result = await PackagingItemPurchase.findOne({ where: { Id: id } });
  return result ? formatStockForDisplay(result) : null;
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await PackagingItemPurchase.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const existingPayload = toBaseStockPayload(existing.unit, existing.unitValue);
    const siblingCount = existing.batchId
      ? await PackagingItemPurchase.count({
          where: { batchId: existing.batchId, Id: { [Op.ne]: id } },
          transaction: t,
        })
      : 0;
    const deleteAmountDelta =
      siblingCount > 0
        ? -toNumber(existing.cost)
        : -(toNumber(existing.cost) + toNumber(existing.othersCost));

    await adjustStockBalance({
      packagingItemId: existing.packagingItemId,
      name: existing.name,
      unit: existingPayload.unit,
      cost: existing.cost,
      delta: -existingPayload.unitValue,
      transaction: t,
    });

    await updateSupplierHistoryAmount({
      supplierHistoryId: existing.supplierHistoryId,
      amountDelta: deleteAmountDelta,
      transaction: t,
    });

    const deletedCount = await PackagingItemPurchase.destroy({
      where: { Id: id },
      transaction: t,
    });

    if (existing.batchId) {
      const remainingBatchCost = await PackagingItemPurchase.sum("cost", {
        where: { batchId: existing.batchId },
        transaction: t,
      });
      const nextOthersCost = siblingCount > 0 ? toNumber(existing.othersCost) : 0;

      await PackagingItemPurchase.update(
        {
          allPackagingItemCost: toNumber(remainingBatchCost) + nextOthersCost,
          othersCost: nextOthersCost,
        },
        { where: { batchId: existing.batchId }, transaction: t },
      );
    }

    return deletedCount;
  });
};

const updateOneFromDB = async (id, payload) => {
  const existing = await PackagingItemPurchase.findOne({ where: { Id: id } });
  if (!existing) return 0;

  const nextPackagingItemId =
    payload.packagingItemId || existing.packagingItemId;
  const packagingItem = await PackagingItem.findOne({
    where: { Id: nextPackagingItemId },
  });
  if (!packagingItem) throw new ApiError(404, "Packaging item not found");

  const nextUnit =
    payload.unit === "" || payload.unit == null ? existing.unit : payload.unit;
  const nextUnitValue =
    payload.unitValue === "" || payload.unitValue == null
      ? existing.unitValue
      : payload.unitValue;
  const normalizedPayload = toBaseStockPayload(nextUnit, nextUnitValue);
  const nextCost =
    payload.unitCost !== undefined &&
    payload.unitCost !== null &&
    payload.unitCost !== ""
      ? toNumber(payload.unitCost) * normalizedPayload.inputUnitValue
      : payload.totalCost !== undefined &&
          payload.totalCost !== null &&
          payload.totalCost !== ""
        ? toNumber(payload.totalCost)
        : payload.cost === "" || payload.cost == null
          ? toNumber(existing.cost)
          : toNumber(payload.cost);
  const nextUnitCost =
    payload.unitCost === "" || payload.unitCost == null
      ? normalizedPayload.inputUnitValue > 0
        ? nextCost / normalizedPayload.inputUnitValue
        : toNumber(existing.unitCost)
      : toNumber(payload.unitCost);

  return db.sequelize.transaction(async (t) => {
    const existingPayload = toBaseStockPayload(existing.unit, existing.unitValue);
    await adjustStockBalance({
      packagingItemId: existing.packagingItemId,
      name: existing.name,
      unit: existingPayload.unit,
      cost: existing.cost,
      delta: -existingPayload.unitValue,
      transaction: t,
    });

    await adjustStockBalance({
      packagingItemId: nextPackagingItemId,
      name: packagingItem.name,
      unit: normalizedPayload.unit,
      cost: nextCost,
      delta: normalizedPayload.unitValue,
      transaction: t,
      createOnPositive: true,
    });

    const nextSupplierId =
      payload.supplierId === "" || payload.supplierId == null
        ? existing.supplierId
        : payload.supplierId;
    const batchId = payload.batchId || existing.batchId;
    const nextOthersCost =
      payload.othersCost === "" || payload.othersCost == null
        ? toNumber(existing.othersCost)
        : Math.max(0, toNumber(payload.othersCost));
    let allPackagingItemCost = nextCost;

    if (batchId) {
      const siblingCost = await PackagingItemPurchase.sum("cost", {
        where: { batchId, Id: { [Op.ne]: id } },
        transaction: t,
      });
      allPackagingItemCost = toNumber(siblingCost) + nextCost + nextOthersCost;
    } else {
      allPackagingItemCost = nextCost + nextOthersCost;
    }

    const supplierCostDelta =
      allPackagingItemCost - toNumber(existing.allPackagingItemCost || existing.cost);
    let supplierHistoryId = existing.supplierHistoryId;

    if (supplierHistoryId) {
      await updateSupplierHistoryAmount({
        supplierHistoryId,
        amountDelta: supplierCostDelta,
        supplierId: nextSupplierId,
        date: payload.date || existing.date,
        note: payload.note === undefined ? existing.note : payload.note || null,
        transaction: t,
      });
    } else if (nextSupplierId && allPackagingItemCost > 0) {
      const supplierHistory = await SupplierHistory.create(
        {
          supplierId: nextSupplierId,
          bookId: payload.bookId || null,
          amount: allPackagingItemCost,
          status: "Unpaid",
          date: payload.date || existing.date || new Date(),
          note:
            payload.note === undefined
              ? `Packaging item purchase: ${packagingItem.name}`
              : payload.note || null,
          file: payload.file || null,
        },
        { transaction: t },
      );
      supplierHistoryId = supplierHistory.Id;
    }

    const [count] = await PackagingItemPurchase.update(
      {
        packagingItemId: nextPackagingItemId,
        supplierId: nextSupplierId,
        name: packagingItem.name,
        unit: normalizedPayload.unit,
        unitValue: normalizedPayload.unitValue,
        unitCost: nextUnitCost,
        cost: nextCost,
        allPackagingItemCost,
        othersCost: nextOthersCost,
        batchId,
        supplierHistoryId,
        date: payload.date || existing.date,
        note: payload.note === undefined ? existing.note : payload.note || null,
        status: payload.status || existing.status || "Active",
      },
      {
        where: { Id: id },
        transaction: t,
      },
    );

    if (batchId) {
      await PackagingItemPurchase.update(
        { allPackagingItemCost, othersCost: nextOthersCost },
        { where: { batchId }, transaction: t },
      );
    }

    return count;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const data = await PackagingItemPurchase.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(formatStockForDisplay);
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

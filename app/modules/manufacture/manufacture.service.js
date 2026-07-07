const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
  toNumber,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ManufactureSearchableFields } = require("./manufacture.constants");
const { logStockMovement } = require("../../../shared/stockMovementLogger");
const Manufacture = db.manufacture;
const Notification = db.notification;
const User = db.user;
const Item = db.item;
const Supplier = db.supplier;
const ItemMaster = db.itemMaster;

const parseVariantPayload = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const buildVariantKey = (variant) => {
  const normalized = parseVariantPayload(variant);
  if (!normalized) return null;

  const entries = Object.entries(normalized)
    .map(([key, value]) => [key, String(value || "").trim()])
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) return null;
  return entries.map(([key, value]) => `${key}:${value}`).join("|");
};

const buildStockWhere = ({ itemId, productId, variantKey }) => {
  const where = { itemId };

  if (productId) {
    where.productId = productId;
  }

  if (variantKey) {
    where.variantKey = variantKey;
  } else {
    const emptyVariantCondition = {
      [Op.or]: [{ variantKey: null }, { variantKey: "" }],
    };

    if (where[Op.and]) {
      where[Op.and].push(emptyVariantCondition);
    } else {
      where[Op.and] = [emptyVariantCondition];
    }
  }

  return where;
};

const normalizeUnitPayload = (unit, unitValue) => {
  return toBaseStockPayload(unit, unitValue);
};

const adjustStockBalance = async ({
  Model,
  stockLabel,
  itemId,
  productId,
  name,
  variant,
  variantKey,
  unit,
  unitValue,
  cost = 0,
  delta,
  transaction,
  createOnPositive = false,
  ignoreMissingOnNegative = false,
  movementContext = null,
}) => {
  if (!delta) return null;

  const stockRow = await Model.findOne({
    where: buildStockWhere({ itemId, productId, variantKey }),
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["createdAt", "ASC"]],
  });

  if (!stockRow) {
    if (createOnPositive && delta > 0) {
      const createdStockRow = await Model.create(
        {
          itemId,
          productId: productId || null,
          name,
          variant,
          variantKey: variantKey || null,
          unit,
          unitValue: delta,
          cost: toNumber(cost),
        },
        { transaction },
      );
      await logStockMovement({
        transaction,
        ...movementContext,
        stockType: movementContext?.stockType || stockLabel,
        stockRow: createdStockRow,
        itemId,
        productId: productId || null,
        name,
        variant,
        variantKey: variantKey || null,
        unit,
        quantityChange: delta,
        balanceBefore: 0,
        balanceAfter: delta,
      });
      return createdStockRow;
    }

    if (ignoreMissingOnNegative && delta < 0) {
      return null;
    }

    throw new ApiError(404, `${stockLabel} not found for selected item`);
  }

  const currentStockPayload = toBaseStockPayload(
    stockRow.unit,
    stockRow.unitValue,
  );
  const nextQuantity = currentStockPayload.unitValue + delta;

  if (nextQuantity < 0) {
    throw new ApiError(400, `${stockLabel} cannot be negative`);
  }

  const currentCost = toNumber(stockRow.cost);
  const currentUnitCost =
    currentStockPayload.unitValue > 0
      ? currentCost / currentStockPayload.unitValue
      : 0;
  const nextCost =
    delta > 0
      ? currentCost + toNumber(cost)
      : Math.max(0, currentCost + delta * currentUnitCost);

  const updatedStockRow = await stockRow.update(
    {
      itemId,
      productId: productId || stockRow.productId || null,
      name,
      variant,
      variantKey: variantKey || null,
      unit: currentStockPayload.isWeightUnit ? "Gram" : unit,
      unitValue: nextQuantity,
      cost: nextCost,
    },
    { transaction },
  );
  await logStockMovement({
    transaction,
    ...movementContext,
    stockType: movementContext?.stockType || stockLabel,
    stockRow: updatedStockRow,
    itemId,
    productId: productId || stockRow.productId || null,
    name,
    variant,
    variantKey: variantKey || null,
    unit: currentStockPayload.isWeightUnit ? "Gram" : unit,
    quantityChange: delta,
    balanceBefore: currentStockPayload.unitValue,
    balanceAfter: nextQuantity,
  });
  return updatedStockRow;
};

const insertIntoDB = async (payload) => {
  const {
    itemId,
    productId,
    unit,
    unitValue,
    cost,
    date,
    note,
    status,
    supplierId,
    variant,
    variantKey,
  } = payload;

  const itemData = await Item.findOne({ where: { Id: itemId } });
  if (!itemData) throw new ApiError(404, "Item not found");

  const normalizedPayload = normalizeUnitPayload(unit, unitValue);
  const totalUnitValue = normalizedPayload.unitValue;
  const totalCost = toNumber(cost);
  const normalizedVariant = parseVariantPayload(variant);
  const normalizedVariantKey = variantKey || buildVariantKey(normalizedVariant);

  if (totalUnitValue <= 0) {
    throw new ApiError(400, "unitValue must be greater than 0");
  }

  const calculatedUnitCost =
    totalUnitValue > 0 ? totalCost / totalUnitValue : 0;
  const finalStatus = String(status || "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    const manufactureData = {
      itemId,
      productId: productId || null,
      name: itemData.name,
      variant: normalizedVariant,
      variantKey: normalizedVariantKey,
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      cost: totalCost,
      supplierId,

      // unitCost: calculatedUnitCost,
      date,
      note: finalStatus === "Approved" ? null : note || null,
      status: finalStatus,
    };

    const manufactureRecord = await Manufacture.create(manufactureData, {
      transaction: t,
    });

    await adjustStockBalance({
      Model: ItemMaster,
      stockLabel: "Item stock",
      itemId,
      productId,
      name: itemData.name,
      variant: normalizedVariant,
      variantKey: normalizedVariantKey,
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      cost: totalCost,
      delta: totalUnitValue,
      transaction: t,
      createOnPositive: true,
      movementContext: {
        sourceType: "ItemPurchase",
        sourceId: manufactureRecord.Id,
        operation: "CREATE",
        stockType: "ItemStock",
      },
    });

    return manufactureRecord;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count] = await Promise.all([
    Manufacture.findAll({
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
    Manufacture.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const data = await Manufacture.findAll({ where: { productId: id } });
  return data.map(formatStockForDisplay);
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await Manufacture.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "itemId",
        "productId",
        "name",
        "variant",
        "variantKey",
        "unit",
        "unitValue",
        "cost",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const existingBasePayload = toBaseStockPayload(
      existing.unit,
      existing.unitValue,
    );
    const oldUnitValue = existingBasePayload.unitValue;
    const oldCost = toNumber(existing.cost);
    const oldVariant = parseVariantPayload(existing.variant);

    await adjustStockBalance({
      Model: ItemMaster,
      stockLabel: "Item stock",
      itemId: existing.itemId,
      productId: existing.productId || null,
      name: existing.name,
      variant: oldVariant,
      variantKey: existing.variantKey || null,
      unit: existingBasePayload.unit,
      unitValue: oldUnitValue,
      cost: oldCost,
      delta: -oldUnitValue,
      transaction: t,
      movementContext: {
        sourceType: "ItemPurchase",
        sourceId: existing.Id,
        operation: "DELETE",
        stockType: "ItemStock",
      },
    });

    return Manufacture.destroy({
      where: { Id: id },
      transaction: t,
      movementContext: {
        sourceType: "ItemPurchase",
        sourceId: id,
        operation: "UPDATE_REVERSE",
        stockType: "ItemStock",
      },
    });
  });
};

const updateOneFromDB = async (id, payload) => {
  const {
    itemId,
    productId,
    name,
    unit,
    unitValue,
    cost,
    note,
    date,
    status,
    supplierId,
    userId,
    variant,
    variantKey,
  } = payload;

  const existing = await Manufacture.findOne({
    where: { Id: id },
    attributes: [
      "Id",
      "itemId",
      "productId",
      "name",
      "unit",
      "unitValue",
      "cost",
      "note",
      "status",
      "variant",
      "variantKey",
    ],
  });

  if (!existing) return 0;

  const newNote = String(note || "").trim();
  const inputStatus = String(status || "").trim();
  const finalStatus = inputStatus || existing.status || "Pending";

  const nextUnitInput = unit === "" || unit == null ? existing.unit : unit;
  const nextUnitValueInput =
    unitValue === "" || unitValue == null ? existing.unitValue : unitValue;
  const normalizedPayload = normalizeUnitPayload(
    nextUnitInput,
    nextUnitValueInput,
  );
  const totalUnitValue = normalizedPayload.unitValue;
  const totalCost = cost === "" || cost == null ? undefined : toNumber(cost);
  const nextTotalCost =
    totalCost === undefined ? toNumber(existing.cost) : totalCost;
  const nextItemId = itemId || existing.itemId;
  const nextProductId =
    productId === "" || productId == null ? existing.productId : productId;
  const nextVariant =
    variant === undefined ? parseVariantPayload(existing.variant) : parseVariantPayload(variant);
  const nextVariantKey =
    variantKey === undefined ? existing.variantKey : variantKey || buildVariantKey(nextVariant);
  const nextName = name === "" || name == null ? existing.name : name;

  const data = {
    itemId: nextItemId,
    productId: nextProductId,
    name: nextName,
    variant: nextVariant,
    variantKey: nextVariantKey,
    unit: normalizedPayload.unit,
    unitValue: totalUnitValue,
    cost: nextTotalCost,
    supplierId,
    // unitCost: totalUnitValue > 0 ? nextTotalCost / totalUnitValue : undefined,
    note: finalStatus === "Approved" ? null : newNote || null,
    status: finalStatus,
    date: String(date || "").slice(0, 10) || undefined,
  };

  const oldItemId = existing.itemId;
  const oldProductId = existing.productId || null;
  const oldVariantKey = existing.variantKey || null;
  const existingBasePayload = toBaseStockPayload(
    existing.unit,
    existing.unitValue,
  );
  const oldUnitValue = existingBasePayload.unitValue;
  const oldCost = toNumber(existing.cost);
  const oldVariant = parseVariantPayload(existing.variant);

  const updatedCount = await db.sequelize.transaction(async (t) => {
    await adjustStockBalance({
      Model: ItemMaster,
      stockLabel: "Item stock",
      itemId: oldItemId,
      productId: oldProductId,
      name: existing.name,
      variant: oldVariant,
      variantKey: oldVariantKey,
      unit: existingBasePayload.unit,
      unitValue: oldUnitValue,
      cost: oldCost,
      delta: -oldUnitValue,
      transaction: t,
    });

    await adjustStockBalance({
      Model: ItemMaster,
      stockLabel: "Item stock",
      itemId: nextItemId,
      productId: nextProductId,
      name: nextName,
      variant: nextVariant,
      variantKey: nextVariantKey,
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      cost: nextTotalCost,
      delta: totalUnitValue,
      transaction: t,
      createOnPositive: true,
      movementContext: {
        sourceType: "ItemPurchase",
        sourceId: id,
        operation: "UPDATE_APPLY",
        stockType: "ItemStock",
      },
    });

    const [count] = await Manufacture.update(data, {
      where: { Id: id },
      transaction: t,
    });

    return count;
  });

  if (updatedCount <= 0) return updatedCount;

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (!users.length) return updatedCount;

  const message =
    finalStatus === "Approved"
      ? "Manufacture request approved"
      : newNote || "Manufacture updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/manufacture`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const data = await Manufacture.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(formatStockForDisplay);
};

const ManufactureService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ManufactureService;

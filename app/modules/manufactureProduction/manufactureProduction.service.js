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
  ManufactureProductionSearchableFields,
} = require("./manufactureProduction.constants");

const ManufactureProduction = db.manufactureProduction;
const Item = db.item;
const ItemMaster = db.itemMaster;
const Manufacturer = db.manufacturer;
const ManufacturerStock = db.manufactureStock;

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

const buildItemStockWhere = ({ itemId, productId, variantKey }) => ({
  itemId,
  productId: productId || null,
  variantKey: variantKey || null,
});

const buildManufacturerStockWhere = ({
  manufacturerId,
  itemId,
  productId,
  variantKey,
}) => ({
  manufacturerId,
  itemId,
  productId: productId || null,
  variantKey: variantKey || null,
});

const adjustStockBalance = async ({
  Model,
  where,
  stockLabel,
  itemId,
  productId,
  name,
  manufacturerId,
  manufacturerName,
  variant,
  variantKey,
  unit,
  cost = 0,
  delta,
  transaction,
  createOnPositive = false,
}) => {
  const stockRow = await Model.findOne({
    where,
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!stockRow) {
    if (createOnPositive && delta > 0) {
      return Model.create(
        {
          itemId,
          productId: productId || null,
          name,
          manufacturerId,
          manufacturerName,
          variant,
          variantKey: variantKey || null,
          unit,
          unitValue: delta,
          cost: toNumber(cost),
        },
        { transaction },
      );
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

  return stockRow.update(
    {
      itemId,
      productId: productId || stockRow.productId || null,
      name,
      manufacturerId,
      manufacturerName,
      variant,
      variantKey: variantKey || null,
      unit: currentStockPayload.isWeightUnit ? "Gram" : unit,
      unitValue: nextQuantity,
      cost: nextCost,
    },
    { transaction },
  );
};

const buildPayload = async (payload, existing = null, options = {}) => {
  const itemId = payload.itemId || existing?.itemId;
  const manufacturerId = payload.manufacturerId || existing?.manufacturerId;

  const [item, manufacturer] = await Promise.all([
    Item.findOne({ where: { Id: itemId }, transaction: options.transaction }),
    Manufacturer.findOne({
      where: { Id: manufacturerId },
      transaction: options.transaction,
    }),
  ]);

  if (!item) throw new ApiError(404, "Item not found");
  if (!manufacturer) throw new ApiError(404, "Manufacturer not found");

  const unit = payload.unit === "" || payload.unit == null ? "Pcs" : payload.unit;
  const unitValue =
    payload.unitValue === "" || payload.unitValue == null
      ? existing?.unitValue || 0
      : payload.unitValue;
  const normalizedPayload = toBaseStockPayload(unit, unitValue);
  const totalUnitValue = normalizedPayload.unitValue;

  if (totalUnitValue <= 0) {
    throw new ApiError(400, "unitValue must be greater than 0");
  }

  const variant =
    payload.variant === undefined
      ? parseVariantPayload(existing?.variant)
      : parseVariantPayload(payload.variant);
  const variantKey =
    payload.variantKey === undefined
      ? existing?.variantKey || buildVariantKey(variant)
      : payload.variantKey || buildVariantKey(variant);

  return {
    itemId: item.Id,
    productId:
      payload.productId === "" || payload.productId == null
        ? existing?.productId || null
        : payload.productId,
    manufacturerId: manufacturer.Id,
    manufacturerName: manufacturer.name,
    name: item.name,
    variant,
    variantKey,
    unit: normalizedPayload.unit,
    unitValue: totalUnitValue,
    cost:
      payload.cost === "" || payload.cost == null
        ? toNumber(existing?.cost)
        : toNumber(payload.cost),
    date: payload.date || existing?.date || null,
    note: payload.note !== undefined ? payload.note || null : existing?.note || null,
    status: payload.status || existing?.status || "Active",
  };
};

const insertIntoDB = async (payload = {}) => {
  return db.sequelize.transaction(async (t) => {
    const data = await buildPayload(payload, null, { transaction: t });

    await adjustStockBalance({
      Model: ItemMaster,
      where: buildItemStockWhere(data),
      stockLabel: "Item stock",
      ...data,
      delta: -toNumber(data.unitValue),
      transaction: t,
    });

    await adjustStockBalance({
      Model: ManufacturerStock,
      where: buildManufacturerStockWhere(data),
      stockLabel: "Manufacturer stock",
      ...data,
      delta: toNumber(data.unitValue),
      transaction: t,
      createOnPositive: true,
    });

    return ManufactureProduction.create(data, { transaction: t });
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureProductionSearchableFields.map((field) => ({
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
    andConditions.push({ date: { [Op.between]: [start, end] } });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });
  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count] = await Promise.all([
    ManufactureProduction.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    ManufactureProduction.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data: data.map(formatStockForDisplay),
  };
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await ManufactureProduction.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;
    const data = existing.toJSON();

    await adjustStockBalance({
      Model: ManufacturerStock,
      where: buildManufacturerStockWhere(data),
      stockLabel: "Manufacturer stock",
      ...data,
      delta: -toNumber(data.unitValue),
      transaction: t,
    });

    await adjustStockBalance({
      Model: ItemMaster,
      where: buildItemStockWhere(data),
      stockLabel: "Item stock",
      ...data,
      delta: toNumber(data.unitValue),
      transaction: t,
      createOnPositive: true,
    });

    return ManufactureProduction.destroy({ where: { Id: id }, transaction: t });
  });
};

const updateOneFromDB = async (id, payload = {}) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await ManufactureProduction.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const oldData = existing.toJSON();
    const nextData = await buildPayload(payload, oldData, { transaction: t });

    await adjustStockBalance({
      Model: ManufacturerStock,
      where: buildManufacturerStockWhere(oldData),
      stockLabel: "Manufacturer stock",
      ...oldData,
      delta: -toNumber(oldData.unitValue),
      transaction: t,
    });

    await adjustStockBalance({
      Model: ItemMaster,
      where: buildItemStockWhere(oldData),
      stockLabel: "Item stock",
      ...oldData,
      delta: toNumber(oldData.unitValue),
      transaction: t,
      createOnPositive: true,
    });

    await adjustStockBalance({
      Model: ItemMaster,
      where: buildItemStockWhere(nextData),
      stockLabel: "Item stock",
      ...nextData,
      delta: -toNumber(nextData.unitValue),
      transaction: t,
    });

    await adjustStockBalance({
      Model: ManufacturerStock,
      where: buildManufacturerStockWhere(nextData),
      stockLabel: "Manufacturer stock",
      ...nextData,
      delta: toNumber(nextData.unitValue),
      transaction: t,
      createOnPositive: true,
    });

    const [count] = await ManufactureProduction.update(nextData, {
      where: { Id: id },
      transaction: t,
    });

    return count;
  });
};

const ManufactureProductionService = {
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
  updateOneFromDB,
};

module.exports = ManufactureProductionService;

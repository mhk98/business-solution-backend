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
  PackagingFactorySearchableFields,
} = require("./packagingFactory.constants");

const PackagingFactory = db.packagingFactory;
const PackagingItem = db.packagingItem;
const PackagingItemStock = db.packagingItemStock;
const PackagingManufacturer = db.packagingManufacturer;
const PackagingFactoryStock = db.packagingFactoryStock;

const adjustStockBalance = async ({
  Model,
  where,
  stockLabel,
  packagingItemId,
  manufacturerId = null,
  manufacturerName = null,
  name,
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
    order: [["createdAt", "ASC"]],
  });

  if (!stockRow) {
    if (createOnPositive && delta > 0) {
      return Model.create(
        {
          packagingItemId,
          manufacturerId,
          manufacturerName,
          name,
          unit,
          unitValue: delta,
          cost: toNumber(cost),
        },
        { transaction },
      );
    }
    throw new ApiError(404, `${stockLabel} not found for selected item`);
  }

  const currentPayload = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
  const nextQuantity = currentPayload.unitValue + delta;
  if (nextQuantity < 0) throw new ApiError(400, `${stockLabel} cannot be negative`);

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
      manufacturerId: manufacturerId || stockRow.manufacturerId || null,
      manufacturerName: manufacturerName || stockRow.manufacturerName || null,
      name,
      unit: currentPayload.isConvertedUnit ? currentPayload.unit : unit,
      unitValue: nextQuantity,
      cost: nextCost,
    },
    { transaction },
  );
};

const buildPayload = async (payload, existing = null, options = {}) => {
  const packagingItemId = payload.packagingItemId || existing?.packagingItemId;
  const manufacturerId = payload.manufacturerId || existing?.manufacturerId;
  const [item, manufacturer] = await Promise.all([
    PackagingItem.findOne({ where: { Id: packagingItemId }, transaction: options.transaction }),
    PackagingManufacturer.findOne({ where: { Id: manufacturerId }, transaction: options.transaction }),
  ]);

  if (!item) throw new ApiError(404, "Packaging item not found");
  if (!manufacturer) throw new ApiError(404, "Packaging manufacturer not found");

  const unit = payload.unit === "" || payload.unit == null ? existing?.unit || "Pcs" : payload.unit;
  const unitValue =
    payload.unitValue === "" || payload.unitValue == null
      ? existing?.unitValue || 0
      : payload.unitValue;
  const normalizedPayload = toBaseStockPayload(unit, unitValue);
  if (normalizedPayload.unitValue <= 0) {
    throw new ApiError(400, "unitValue must be greater than 0");
  }

  return {
    packagingItemId: item.Id,
    manufacturerId: manufacturer.Id,
    manufacturerName: manufacturer.name,
    name: item.name,
    unit: normalizedPayload.unit,
    unitValue: normalizedPayload.unitValue,
    cost:
      payload.cost === "" || payload.cost == null
        ? toNumber(existing?.cost)
        : toNumber(payload.cost),
    date: payload.date || existing?.date || null,
    note: payload.note !== undefined ? payload.note || null : existing?.note || null,
    status: payload.status || existing?.status || "Active",
  };
};

const factoryStockWhere = (data) => ({
  packagingItemId: data.packagingItemId,
  manufacturerId: data.manufacturerId,
});

const insertIntoDB = async (payload = {}) =>
  db.sequelize.transaction(async (t) => {
    const data = await buildPayload(payload, null, { transaction: t });
    const record = await PackagingFactory.create(data, { transaction: t });

    await adjustStockBalance({
      Model: PackagingItemStock,
      where: { packagingItemId: data.packagingItemId },
      stockLabel: "Packaging item stock",
      ...data,
      delta: -toNumber(data.unitValue),
      transaction: t,
    });

    await adjustStockBalance({
      Model: PackagingFactoryStock,
      where: factoryStockWhere(data),
      stockLabel: "Packaging factory stock",
      ...data,
      delta: toNumber(data.unitValue),
      transaction: t,
      createOnPositive: true,
    });

    return record;
  });

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingFactorySearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({ date: { [Op.between]: [start, end] } });
  }

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};
  const [data, count] = await Promise.all([
    PackagingFactory.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingFactory.count({ where: whereConditions }),
  ]);

  return { meta: { page, limit, count }, data: data.map(formatStockForDisplay) };
};

const deleteIdFromDB = async (id) =>
  db.sequelize.transaction(async (t) => {
    const existing = await PackagingFactory.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!existing) return 0;
    const oldPayload = toBaseStockPayload(existing.unit, existing.unitValue);

    await adjustStockBalance({
      Model: PackagingFactoryStock,
      where: factoryStockWhere(existing),
      stockLabel: "Packaging factory stock",
      packagingItemId: existing.packagingItemId,
      manufacturerId: existing.manufacturerId,
      manufacturerName: existing.manufacturerName,
      name: existing.name,
      unit: oldPayload.unit,
      cost: existing.cost,
      delta: -oldPayload.unitValue,
      transaction: t,
    });

    await adjustStockBalance({
      Model: PackagingItemStock,
      where: { packagingItemId: existing.packagingItemId },
      stockLabel: "Packaging item stock",
      packagingItemId: existing.packagingItemId,
      name: existing.name,
      unit: oldPayload.unit,
      cost: existing.cost,
      delta: oldPayload.unitValue,
      transaction: t,
      createOnPositive: true,
    });

    return PackagingFactory.destroy({ where: { Id: id }, transaction: t });
  });

const updateOneFromDB = async (id, payload = {}) => {
  const existing = await PackagingFactory.findOne({ where: { Id: id } });
  if (!existing) return 0;

  return db.sequelize.transaction(async (t) => {
    const oldPayload = toBaseStockPayload(existing.unit, existing.unitValue);
    await adjustStockBalance({
      Model: PackagingFactoryStock,
      where: factoryStockWhere(existing),
      stockLabel: "Packaging factory stock",
      packagingItemId: existing.packagingItemId,
      manufacturerId: existing.manufacturerId,
      manufacturerName: existing.manufacturerName,
      name: existing.name,
      unit: oldPayload.unit,
      cost: existing.cost,
      delta: -oldPayload.unitValue,
      transaction: t,
    });
    await adjustStockBalance({
      Model: PackagingItemStock,
      where: { packagingItemId: existing.packagingItemId },
      stockLabel: "Packaging item stock",
      packagingItemId: existing.packagingItemId,
      name: existing.name,
      unit: oldPayload.unit,
      cost: existing.cost,
      delta: oldPayload.unitValue,
      transaction: t,
      createOnPositive: true,
    });

    const data = await buildPayload(payload, existing, { transaction: t });
    await adjustStockBalance({
      Model: PackagingItemStock,
      where: { packagingItemId: data.packagingItemId },
      stockLabel: "Packaging item stock",
      ...data,
      delta: -toNumber(data.unitValue),
      transaction: t,
    });
    await adjustStockBalance({
      Model: PackagingFactoryStock,
      where: factoryStockWhere(data),
      stockLabel: "Packaging factory stock",
      ...data,
      delta: toNumber(data.unitValue),
      transaction: t,
      createOnPositive: true,
    });

    const [count] = await PackagingFactory.update(data, {
      where: { Id: id },
      transaction: t,
    });
    return count;
  });
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
};

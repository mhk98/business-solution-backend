const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
  toNumber,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { PackagingMixerSearchableFields } = require("./packagingMixer.constants");

const PackagingMixer = db.packagingMixer;
const Item = db.item;
const ItemMaster = db.itemMaster;
const PackagingManufacturer = db.packagingManufacturer;
const PackagingManufacturerTransaction = db.packagingManufacturerTransaction;
const PackagingFactoryStock = db.packagingFactoryStock;

const normalizePackagingItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      packagingFactoryStockId: Number(item.packagingFactoryStockId || item.Id),
      unitValue: toNumber(item.unitValue),
    }))
    .filter((item) => item.packagingFactoryStockId && item.unitValue > 0);

const adjustItemStock = async ({ itemId, name, unit, unitValue, cost, delta, transaction }) => {
  const stockRow = await ItemMaster.findOne({
    where: {
      itemId,
      [Op.and]: [{ [Op.or]: [{ variantKey: null }, { variantKey: "" }] }],
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["createdAt", "ASC"]],
  });

  if (!stockRow && delta > 0) {
    return ItemMaster.create(
      {
        itemId,
        productId: null,
        name,
        unit,
        unitValue: delta,
        cost: toNumber(cost),
      },
      { transaction },
    );
  }

  if (!stockRow) throw new ApiError(404, "Item stock not found");
  const current = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
  const nextQuantity = current.unitValue + delta;
  if (nextQuantity < 0) throw new ApiError(400, "Item stock cannot be negative");

  const currentCost = toNumber(stockRow.cost);
  const currentUnitCost = current.unitValue > 0 ? currentCost / current.unitValue : 0;
  const nextCost =
    delta > 0
      ? currentCost + toNumber(cost)
      : Math.max(0, currentCost + delta * currentUnitCost);

  return stockRow.update(
    {
      itemId,
      name,
      unit: current.isConvertedUnit ? current.unit : unit,
      unitValue: nextQuantity,
      cost: nextCost,
    },
    { transaction },
  );
};

const adjustFactoryStock = async ({ stockId, delta, transaction }) => {
  const stockRow = await PackagingFactoryStock.findOne({
    where: { Id: stockId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!stockRow) throw new ApiError(404, "Packaging factory stock not found");

  const current = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
  const nextQuantity = current.unitValue + delta;
  if (nextQuantity < 0) {
    throw new ApiError(400, `${stockRow.name} packaging factory stock not enough`);
  }

  const currentCost = toNumber(stockRow.cost);
  const currentUnitCost = current.unitValue > 0 ? currentCost / current.unitValue : 0;
  return stockRow.update(
    {
      unitValue: nextQuantity,
      cost: Math.max(0, currentCost + delta * currentUnitCost),
    },
    { transaction },
  );
};

const createWageTransaction = async (data, transaction) => {
  if (!data.manufacturerId || toNumber(data.wageAmount) <= 0) return null;
  return PackagingManufacturerTransaction.create(
    {
      manufacturerId: data.manufacturerId,
      manufacturerName: data.manufacturerName,
      mixerId: data.mixerId || null,
      type: data.type || "PACKAGING_MIXER_WAGE",
      description: data.description || `Packaging mixer wage - ${data.name}`,
      debit: toNumber(data.debit ?? data.wageAmount),
      credit: toNumber(data.credit),
      date: data.date || new Date().toISOString().slice(0, 10),
      note: data.note || null,
    },
    { transaction },
  );
};

const buildPayload = async (payload, existing = null) => {
  const itemId = payload.itemId || existing?.itemId;
  const manufacturerId = payload.manufacturerId || existing?.manufacturerId;
  const [item, manufacturer] = await Promise.all([
    Item.findOne({ where: { Id: itemId } }),
    PackagingManufacturer.findOne({ where: { Id: manufacturerId } }),
  ]);
  if (!item) throw new ApiError(404, "Item not found");
  if (!manufacturer) throw new ApiError(404, "Packaging manufacturer not found");

  const unit = payload.unit || existing?.unit || "Pcs";
  const unitValue = toNumber(payload.unitValue ?? existing?.unitValue);
  if (unitValue <= 0) throw new ApiError(400, "Unit details must be greater than 0");
  const unitCost = toNumber(payload.unitCost ?? existing?.unitCost);
  const wage = toNumber(payload.wage ?? existing?.wage);
  const itemQuantity = toNumber(payload.itemQuantity ?? existing?.itemQuantity);

  return {
    itemId: item.Id,
    name: item.name,
    manufacturerId: manufacturer.Id,
    manufacturerName: manufacturer.name,
    packagingItems: normalizePackagingItems(payload.packagingItems || existing?.packagingItems || []),
    unit,
    unitValue,
    unitCost,
    itemQuantity,
    wage,
    wageAmount: unitValue * wage,
    date: payload.date || existing?.date || new Date().toISOString().slice(0, 10),
    note: payload.note !== undefined ? payload.note || null : existing?.note || null,
    status: payload.status || existing?.status || "Active",
  };
};

const applyRecordEffects = async (data, recordId, transaction) => {
  for (const item of data.packagingItems || []) {
    await adjustFactoryStock({
      stockId: item.packagingFactoryStockId,
      delta: -toNumber(item.unitValue),
      transaction,
    });
  }

  await adjustItemStock({
    itemId: data.itemId,
    name: data.name,
    unit: data.unit,
    unitValue: data.unitValue,
    cost: data.unitValue * data.unitCost,
    delta: data.unitValue,
    transaction,
  });

  await createWageTransaction(
    {
      ...data,
      mixerId: recordId,
      note: `${data.unitValue} x ${data.wage}`,
    },
    transaction,
  );
};

const reverseRecordEffects = async (record, transaction) => {
  const items = normalizePackagingItems(record.packagingItems || []);
  for (const item of items) {
    await adjustFactoryStock({
      stockId: item.packagingFactoryStockId,
      delta: toNumber(item.unitValue),
      transaction,
    });
  }

  await adjustItemStock({
    itemId: record.itemId,
    name: record.name,
    unit: record.unit,
    unitValue: record.unitValue,
    cost: record.unitValue * record.unitCost,
    delta: -toNumber(record.unitValue),
    transaction,
  });

  if (toNumber(record.wageAmount) > 0) {
    await createWageTransaction(
      {
        manufacturerId: record.manufacturerId,
        manufacturerName: record.manufacturerName,
        mixerId: record.Id,
        type: "PACKAGING_MIXER_WAGE_REVERSAL",
        description: `Reverse packaging mixer wage - ${record.name}`,
        debit: 0,
        credit: record.wageAmount,
        date: record.date,
      },
      transaction,
    );
  }
};

const insertIntoDB = async (payload = {}) =>
  db.sequelize.transaction(async (t) => {
    const data = await buildPayload(payload);
    const record = await PackagingMixer.create(data, { transaction: t });
    await applyRecordEffects(data, record.Id, t);
    return record;
  });

const updateOneFromDB = async (id, payload = {}) =>
  db.sequelize.transaction(async (t) => {
    const existing = await PackagingMixer.findOne({ where: { Id: id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!existing) return 0;
    await reverseRecordEffects(existing, t);
    const data = await buildPayload(payload, existing);
    await applyRecordEffects(data, id, t);
    const [count] = await PackagingMixer.update(data, { where: { Id: id }, transaction: t });
    return count;
  });

const deleteIdFromDB = async (id) =>
  db.sequelize.transaction(async (t) => {
    const existing = await PackagingMixer.findOne({ where: { Id: id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!existing) return 0;
    await reverseRecordEffects(existing, t);
    return PackagingMixer.destroy({ where: { Id: id }, transaction: t });
  });

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingMixerSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }
  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") andConditions.push({ [key]: { [Op.eq]: value } });
  });
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({ date: { [Op.between]: [start, end] } });
  }
  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const [data, count] = await Promise.all([
    PackagingMixer.findAll({ where, offset: skip, limit, paranoid: true, order: [["createdAt", "DESC"]] }),
    PackagingMixer.count({ where }),
  ]);
  return { meta: { page, limit, count }, data: data.map(formatStockForDisplay) };
};

module.exports = {
  getAllFromDB,
  insertIntoDB,
  updateOneFromDB,
  deleteIdFromDB,
};

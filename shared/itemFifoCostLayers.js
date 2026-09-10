// FIFO cost-layer engine for manufacture raw-material items.
//
// Layers live at Item Stock level (`item_masters` rows with productId null),
// keyed by itemId. A purchase opens a layer at its unit cost; Factory
// production (and any other outflow) consumes the oldest layers first. Every
// function runs inside the caller's transaction.
//
// Mirrors shared/packagingFifoCostLayers.js.
const db = require("../models");
const { toBaseStockPayload } = require("../helpers/unitConversionHelper");

const { Op } = db.Sequelize;
const Layer = () => db.itemCostLayer;
const ItemStock = () => db.itemMaster;

const n = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};
const round2 = (value) => Math.round(n(value) * 100) / 100;
const round4 = (value) => Math.round(n(value) * 10000) / 10000;
const today = () => new Date().toISOString().slice(0, 10);

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// `quantity` / `unitCost` are per BASE unit.
const openLayer = async ({
  transaction,
  itemId,
  unitCost,
  quantity,
  receivedDate,
  sourceType,
  sourceMovementId = null,
  note = null,
}) => {
  const qty = round2(quantity);
  if (!Number(itemId) || qty <= 0) return null;

  return Layer().create(
    {
      itemId: Number(itemId),
      sourceType: sourceType || "Unknown",
      sourceMovementId: sourceMovementId || null,
      receivedDate: receivedDate || today(),
      originalQty: qty,
      remainingQty: qty,
      unitCost: round4(unitCost),
      note,
    },
    { transaction },
  );
};

// Consume `quantity` (base units) FIFO — oldest receivedDate first.
const consumeFifo = async ({
  transaction,
  itemId,
  quantity,
  fallbackUnitCost = 0,
}) => {
  const need = round2(quantity);
  const result = {
    unitCostConsumed: 0,
    totalCost: 0,
    costBreakdown: [],
    shortfallQty: 0,
  };
  if (!Number(itemId) || need <= 0) return result;

  const layers = await Layer().findAll({
    where: { itemId: Number(itemId), remainingQty: { [Op.gt]: 0 } },
    order: [
      ["receivedDate", "ASC"],
      ["Id", "ASC"],
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let remaining = need;
  let totalCost = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, n(layer.remainingQty));
    if (take <= 0) continue;
    const unitCost = n(layer.unitCost);
    totalCost += take * unitCost;
    result.costBreakdown.push({
      layerId: layer.Id,
      qty: round2(take),
      unitCost: round4(unitCost),
    });
    await layer.update(
      { remainingQty: round2(n(layer.remainingQty) - take) },
      { transaction },
    );
    remaining = round2(remaining - take);
  }

  if (remaining > 0) {
    const unitCost = round4(fallbackUnitCost);
    totalCost += remaining * unitCost;
    result.shortfallQty = remaining;
    result.costBreakdown.push({
      layerId: null,
      qty: remaining,
      unitCost,
      estimated: true,
    });
  }

  result.totalCost = round2(totalCost);
  result.unitCostConsumed = need > 0 ? round4(totalCost / need) : 0;
  return result;
};

const restoreToLayers = async ({ transaction, costBreakdown }) => {
  const entries = asArray(costBreakdown);
  let restoredQty = 0;
  for (const entry of entries) {
    if (!entry || !entry.layerId) continue;
    const layer = await Layer().findByPk(entry.layerId, {
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!layer) continue;
    const next = Math.min(
      n(layer.originalQty),
      round2(n(layer.remainingQty) + n(entry.qty)),
    );
    restoredQty += next - n(layer.remainingQty);
    await layer.update({ remainingQty: next }, { transaction });
  }
  return { restoredQty: round2(restoredQty) };
};

// Remove `quantity` newest-first (a purchase reversed/deleted).
const unwindInbound = async ({ transaction, itemId, quantity }) => {
  const need = round2(quantity);
  if (!Number(itemId) || need <= 0) return { removedQty: 0 };

  const layers = await Layer().findAll({
    where: { itemId: Number(itemId), remainingQty: { [Op.gt]: 0 } },
    order: [
      ["receivedDate", "DESC"],
      ["Id", "DESC"],
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let remaining = need;
  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, n(layer.remainingQty));
    await layer.update(
      { remainingQty: round2(n(layer.remainingQty) - take) },
      { transaction },
    );
    remaining = round2(remaining - take);
  }
  return { removedQty: round2(need - remaining) };
};

// Σ(remainingQty × unitCost) across an item's open layers.
const layerValue = async ({ transaction, itemId }) => {
  const row = await Layer().findOne({
    attributes: [
      [
        db.Sequelize.fn(
          "SUM",
          db.Sequelize.literal("remainingQty * unitCost"),
        ),
        "value",
      ],
      [db.Sequelize.fn("SUM", db.Sequelize.col("remainingQty")), "qty"],
    ],
    where: { itemId: Number(itemId) },
    transaction,
    raw: true,
  });
  return { value: round2(row && row.value), qty: round2(row && row.qty) };
};

const currentUnitCost = async ({ transaction, itemId, fallback = 0 }) => {
  const { value, qty } = await layerValue({ transaction, itemId });
  return qty > 0 ? round4(value / qty) : round4(fallback);
};

// Keep the flat (productId null) Item Stock row's `cost` in step with layers.
const syncItemStockCost = async ({ transaction, itemId }) => {
  const stockRow = await ItemStock().findOne({
    where: {
      itemId: Number(itemId),
      [Op.or]: [{ productId: null }, { productId: 0 }],
    },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    order: [["createdAt", "ASC"]],
  });
  if (!stockRow) return;

  const { value } = await layerValue({ transaction, itemId });
  const base = toBaseStockPayload(stockRow.unit, stockRow.unitValue).unitValue;
  const nextCost = base > 0 ? Math.max(0, value) : 0;
  if (round2(stockRow.cost) !== round2(nextCost)) {
    await stockRow.update({ cost: round2(nextCost) }, { transaction });
  }
};

module.exports = {
  openLayer,
  consumeFifo,
  restoreToLayers,
  unwindInbound,
  layerValue,
  currentUnitCost,
  syncItemStockCost,
};

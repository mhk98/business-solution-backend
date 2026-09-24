const db = require("../models");
const { businessDate } = require("./stockReportBalances");
const { toNumber } = require("../helpers/unitConversionHelper");

const getDirection = (quantityChange) => {
  const value = toNumber(quantityChange);
  if (value > 0) return "IN";
  if (value < 0) return "OUT";
  return "NONE";
};

// null = the flow did not supply a price (unknown). A supplied 0 is kept as 0
// (a real, if unusual, value). Anything non-finite or negative is treated as
// unknown.
const normalizePrice = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
};

// The source document behind each movement sourceType (all have a DATEONLY
// `date`). Dated stock balances sit a movement on the day it happened, so a
// flow that forgets to pass `date` must fall back to its document's date —
// not today, which would misplace every backdated entry.
const SOURCE_DOCUMENT_MODELS = {
  ReceivedProduct: "receivedProduct",
  PurchaseReturnProduct: "purchaseReturnProduct",
  InTransitProduct: "inTransitProduct",
  ReturnProduct: "returnProduct",
  PosReport: "posReport",
  CourierNoEntry: "courierNoEntry",
  DamageProduct: "damageProduct",
  DamageReturn: "damageProduct",
  DamageRepair: "damageRepair",
  DamageRepairReturn: "damageRepair",
  DamageRepaired: "damageRepaired",
  ItemPurchase: "manufacture",
  Factory: "manufactureProduction",
  Mixer: "mixer",
  StockAdjustment: "stockAdjustment",
  FactoryStockAdjustment: "factoryStockAdjustment",
  PackagingItemPurchase: "packagingItemPurchase",
  PackagingFactory: "packagingFactory",
  PackagingMixer: "packagingMixer",
  PackagingItemStockAdjustment: "packagingItemStockAdjustment",
  PackagingFactoryStockAdjustment: "packagingFactoryStockAdjustment",
};

const toDateKey = (value) =>
  value instanceof Date ? businessDate(value) : String(value).slice(0, 10);

const resolveMovementDate = async ({ date, sourceType, sourceId, transaction }) => {
  if (date) return toDateKey(date);
  const Model = db[SOURCE_DOCUMENT_MODELS[sourceType]];
  if (Model && sourceId) {
    const document = await Model.findByPk(sourceId, {
      attributes: ["date"],
      paranoid: false,
      transaction,
    });
    if (document?.date) return toDateKey(document.date);
  }
  return businessDate();
};

const logStockMovement = async ({
  transaction,
  sourceType,
  sourceId = null,
  operation,
  stockType,
  stockRow = null,
  itemId = null,
  productId = null,
  manufacturerId = null,
  name = null,
  variant = null,
  variantKey = null,
  unit = null,
  date = null,
  quantityChange,
  balanceBefore,
  balanceAfter,
  metadata = null,
  // Movement-based costing (Phase 0). All nullable — pass what the flow knows.
  unitCost = null,
  unitSalePrice = null,
  unitCostConsumed = null,
  costBreakdown = null,
  averageCostAfter = null,
}) => {
  const change = toNumber(quantityChange);
  if (!db.stockMovement || !change) return null;
  if (!sourceType || !operation || !stockType) {
    // A stock change with no movement context is a tracking gap: dated stock
    // balances are rebuilt from these rows, so make the miss visible.
    console.warn("[stockMovement] untracked stock change", {
      sourceType, operation, stockType, name,
      stockRowId: stockRow?.Id || stockRow?.id || null, quantityChange: change,
    });
    return null;
  }

  const resolvedStockRow = stockRow?.toJSON ? stockRow.toJSON() : stockRow || {};

  const created = await db.stockMovement.create(
    {
      sourceType,
      sourceId: sourceId || null,
      operation,
      stockType,
      stockRowId: resolvedStockRow.Id || resolvedStockRow.id || null,
      itemId: itemId || resolvedStockRow.itemId || null,
      productId: productId || resolvedStockRow.productId || null,
      manufacturerId: manufacturerId || resolvedStockRow.manufacturerId || null,
      name: name || resolvedStockRow.name || null,
      variant: variant !== undefined ? variant : resolvedStockRow.variant || null,
      variantKey:
        variantKey !== undefined ? variantKey || null : resolvedStockRow.variantKey || null,
      direction: getDirection(change),
      unit: unit || resolvedStockRow.unit || null,
      date: await resolveMovementDate({ date, sourceType, sourceId, transaction }),
      quantityChange: change,
      balanceBefore: toNumber(balanceBefore),
      balanceAfter: toNumber(balanceAfter),
      metadata,
      unitCost: normalizePrice(unitCost),
      unitSalePrice: normalizePrice(unitSalePrice),
      unitCostConsumed: normalizePrice(unitCostConsumed),
      costBreakdown: costBreakdown || null,
      averageCostAfter: normalizePrice(averageCostAfter),
    },
    { transaction },
  );
  // Flows that move stock before creating their document can't pass a
  // sourceId yet; remember the movement so the caller can attach it once the
  // document exists (pendingMark / assignPendingSource).
  if (!sourceId && transaction && created?.Id) {
    transaction.__pendingStockMovements = transaction.__pendingStockMovements || [];
    transaction.__pendingStockMovements.push(created.Id);
  }
  // Every stock change re-costs the open month once it's committed.
  if (transaction && !transaction.__averageCostScheduled && transaction.afterCommit) {
    transaction.__averageCostScheduled = true;
    transaction.afterCommit(() => require("./averageCostRunner").scheduleAverageRecompute());
  }
  return created;
};

// Position in this transaction's list of movements still missing a sourceId.
const pendingMark = (transaction) => (transaction?.__pendingStockMovements || []).length;

// Attach every sourceId-less movement logged since `from` (a pendingMark, or a
// [from, to) range) to the document that now exists. The average cost engine
// links a movement to its document by sourceType + sourceId.
const assignPendingSource = async (transaction, range, sourceId) => {
  const [from, to] = Array.isArray(range) ? range : [range, undefined];
  const ids = (transaction?.__pendingStockMovements || []).slice(from, to).filter(Boolean);
  if (!ids.length || !sourceId) return;
  await db.stockMovement.update({ sourceId }, { where: { Id: ids }, transaction });
};

module.exports = {
  logStockMovement,
  pendingMark,
  assignPendingSource,
};

const db = require("../models");
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
}) => {
  if (!db.stockMovement || !sourceType || !operation || !stockType) return null;

  const change = toNumber(quantityChange);
  if (!change) return null;

  const resolvedStockRow = stockRow?.toJSON ? stockRow.toJSON() : stockRow || {};

  return db.stockMovement.create(
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
      date: date || new Date().toISOString().slice(0, 10),
      quantityChange: change,
      balanceBefore: toNumber(balanceBefore),
      balanceAfter: toNumber(balanceAfter),
      metadata,
      unitCost: normalizePrice(unitCost),
      unitSalePrice: normalizePrice(unitSalePrice),
      unitCostConsumed: normalizePrice(unitCostConsumed),
      costBreakdown: costBreakdown || null,
    },
    { transaction },
  );
};

module.exports = {
  logStockMovement,
};

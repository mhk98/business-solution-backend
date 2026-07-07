const db = require("../models");
const { toNumber } = require("../helpers/unitConversionHelper");

const getDirection = (quantityChange) => {
  const value = toNumber(quantityChange);
  if (value > 0) return "IN";
  if (value < 0) return "OUT";
  return "NONE";
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
  quantityChange,
  balanceBefore,
  balanceAfter,
  metadata = null,
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
      quantityChange: change,
      balanceBefore: toNumber(balanceBefore),
      balanceAfter: toNumber(balanceAfter),
      metadata,
    },
    { transaction },
  );
};

module.exports = {
  logStockMovement,
};

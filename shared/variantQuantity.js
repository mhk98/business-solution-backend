const parseVariants = require("./parseVariants");
const ApiError = require("../error/ApiError");

const toFiniteNumber = (value) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getVariantQuantityTotal = (variants) =>
  parseVariants(variants).reduce((sum, variant) => {
    const quantity = toFiniteNumber(variant?.quantity);
    return sum + quantity;
  }, 0);

const hasVariantRows = (variants) => parseVariants(variants).length > 0;

const getInventoryDisplayQuantity = (row = {}) => {
  const variantTotal = getVariantQuantityTotal(row.variants);
  return hasVariantRows(row.variants) ? variantTotal : Number(row.quantity || 0);
};

const getInventoryStockBalance = (row = {}) => {
  const variants = parseVariants(row.variants);

  if (variants.length) {
    const fallbackPurchasePrice = toFiniteNumber(row.purchase_price);

    return variants.reduce((sum, variant) => {
      const quantity = toFiniteNumber(variant?.quantity);
      const variantPurchasePrice = toFiniteNumber(variant?.purchase_price);
      const purchasePrice =
        variantPurchasePrice > 0 ? variantPurchasePrice : fallbackPurchasePrice;

      return sum + quantity * purchasePrice;
    }, 0);
  }

  return toFiniteNumber(row.quantity) * toFiniteNumber(row.purchase_price);
};

const normalizeInventoryQuantityForDisplay = (row) => {
  const plain = typeof row?.get === "function" ? row.get({ plain: true }) : row;
  if (!plain) return plain;

  return {
    ...plain,
    quantity: getInventoryDisplayQuantity(plain),
  };
};

const getSyncedInventoryQuantity = (quantity, variants) =>
  hasVariantRows(variants)
    ? getVariantQuantityTotal(variants)
    : toFiniteNumber(quantity);

const assertNonNegativeInventoryQuantity = (quantity) => {
  if (toFiniteNumber(quantity) < 0) {
    throw new ApiError(400, "Inventory cannot be negative");
  }
};

const assertNonNegativeInventoryVariants = (variants) => {
  parseVariants(variants).forEach((variant) => {
    if (toFiniteNumber(variant?.quantity) < 0) {
      throw new ApiError(400, "Inventory variant cannot be negative");
    }
  });
};

const buildSyncedInventoryStockPayload = ({ quantity, variants, ...rest }) => {
  assertNonNegativeInventoryVariants(variants);
  const syncedQuantity = getSyncedInventoryQuantity(quantity, variants);
  assertNonNegativeInventoryQuantity(syncedQuantity);

  return {
    ...rest,
    quantity: syncedQuantity,
    variants,
  };
};

module.exports = {
  getVariantQuantityTotal,
  hasVariantRows,
  getInventoryDisplayQuantity,
  getInventoryStockBalance,
  normalizeInventoryQuantityForDisplay,
  getSyncedInventoryQuantity,
  assertNonNegativeInventoryQuantity,
  assertNonNegativeInventoryVariants,
  buildSyncedInventoryStockPayload,
};

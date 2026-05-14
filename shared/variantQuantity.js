const parseVariants = require("./parseVariants");

const getVariantQuantityTotal = (variants) =>
  parseVariants(variants).reduce((sum, variant) => {
    const quantity = Number(variant?.quantity || 0);
    return sum + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);

const hasVariantRows = (variants) => parseVariants(variants).length > 0;

const getInventoryDisplayQuantity = (row = {}) => {
  const variantTotal = getVariantQuantityTotal(row.variants);
  return hasVariantRows(row.variants) ? variantTotal : Number(row.quantity || 0);
};

const normalizeInventoryQuantityForDisplay = (row) => {
  const plain = typeof row?.get === "function" ? row.get({ plain: true }) : row;
  if (!plain) return plain;

  return {
    ...plain,
    quantity: getInventoryDisplayQuantity(plain),
  };
};

module.exports = {
  getVariantQuantityTotal,
  hasVariantRows,
  getInventoryDisplayQuantity,
  normalizeInventoryQuantityForDisplay,
};

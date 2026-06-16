const ApiError = require("../error/ApiError");
const parseVariants = require("./parseVariants");
const {
  getVariantQuantityTotal,
  hasVariantRows,
} = require("./variantQuantity");

const assertInventoryMovementVariants = ({
  inventory,
  variants,
  quantity,
  message = "Please select variants for this product",
}) => {
  const inventoryHasVariants = hasVariantRows(inventory?.variants);
  const movementVariants = parseVariants(variants);

  if (inventoryHasVariants && !movementVariants.length) {
    throw new ApiError(400, message);
  }

  if (
    movementVariants.length &&
    getVariantQuantityTotal(movementVariants) !== Number(quantity || 0)
  ) {
    throw new ApiError(400, "Variant quantity must match total quantity");
  }
};

const getVariantKey = (variant = {}) =>
  `${String(variant?.size || "")}__${String(variant?.color || "")}`;

const assertInventoryVariantStock = ({
  inventory,
  variants,
  message = "Selected variant is not available in inventory",
}) => {
  const movementVariants = parseVariants(variants);
  if (!movementVariants.length) return;

  const availableByVariant = new Map();
  parseVariants(inventory?.variants).forEach((variant) => {
    availableByVariant.set(
      getVariantKey(variant),
      Number(variant?.quantity || 0),
    );
  });

  movementVariants.forEach((variant) => {
    const requestedQuantity = Number(variant?.quantity || 0);
    const availableQuantity = availableByVariant.get(getVariantKey(variant));

    if (availableQuantity === undefined) {
      throw new ApiError(400, message);
    }

    if (requestedQuantity > Number(availableQuantity || 0)) {
      throw new ApiError(400, "Variant quantity exceeds available stock");
    }
  });
};

module.exports = {
  assertInventoryMovementVariants,
  assertInventoryVariantStock,
};

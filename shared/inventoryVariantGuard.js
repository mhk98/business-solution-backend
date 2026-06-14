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

module.exports = {
  assertInventoryMovementVariants,
};

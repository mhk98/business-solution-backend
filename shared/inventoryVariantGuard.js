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
    !inventoryHasVariants &&
    movementVariants.length &&
    Number(inventory?.quantity || 0) > 0
  ) {
    throw new ApiError(
      400,
      "This product already has non-variant stock. Please clear stock before using variants.",
    );
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

const parseVariationValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const productHasConfiguredVariations = async (db, productId, transaction) => {
  const catalogProductId = Number(productId || 0);
  if (!db?.variation || !catalogProductId) return false;

  const variations = await db.variation.findAll({
    where: { productId: catalogProductId },
    attributes: ["size", "color"],
    transaction,
    raw: true,
  });

  return variations.some(
    (variation) =>
      parseVariationValue(variation?.size).length > 0 ||
      parseVariationValue(variation?.color).length > 0,
  );
};

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

const assertCatalogInventoryMovementVariants = async ({
  db,
  productId,
  inventory,
  variants,
  quantity,
  transaction,
  message = "Please select variants for this product",
}) => {
  const catalogProductId = Number(productId || inventory?.productId || 0);
  const movementVariants = parseVariants(variants);
  let catalogHasVariants = false;

  catalogHasVariants = await productHasConfiguredVariations(
    db,
    catalogProductId,
    transaction,
  );

  const inventoryHasVariants = hasVariantRows(inventory?.variants);
  const shouldUseVariants = catalogHasVariants || inventoryHasVariants;

  if (shouldUseVariants && !movementVariants.length) {
    throw new ApiError(400, message);
  }

  if (!shouldUseVariants && movementVariants.length) {
    throw new ApiError(
      400,
      "This product is not configured for variants. Please update product variants before using variant stock.",
    );
  }

  assertInventoryMovementVariants({
    inventory,
    variants: movementVariants,
    quantity,
    message,
  });
};

module.exports = {
  assertInventoryMovementVariants,
  assertInventoryVariantStock,
  assertCatalogInventoryMovementVariants,
  productHasConfiguredVariations,
};

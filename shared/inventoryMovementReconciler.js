const parseVariants = require("./parseVariants");
const {
  buildSyncedInventoryStockPayload,
  getVariantQuantityTotal,
  hasVariantRows,
} = require("./variantQuantity");

const parseItems = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const getMovementQuantity = (value = {}) =>
  toNumber(value.quantity ?? value.qty ?? value.returnQty);

const getInventoryReferenceId = (value = {}) =>
  Number(value.inventoryId || value.Id || value.receivedId || value.productId || 0);

const variantKey = (variant = {}) =>
  `${String(variant.size || "")}__${String(variant.color || "")}`;

const applyVariantDelta = (map, variants, sign) => {
  parseVariants(variants).forEach((variant) => {
    const key = variantKey(variant);
    const previous = map.get(key) || {
      ...variant,
      size: variant.size || "",
      color: variant.color || "",
      quantity: 0,
    };
    const quantity = toNumber(previous.quantity) + sign * toNumber(variant.quantity);

    map.set(key, {
      ...previous,
      ...variant,
      quantity,
    });
  });
};

const addPlainQuantity = (state, quantity, sign) => {
  state.plainQuantity += sign * toNumber(quantity);
};

const applyMovement = (state, row, sign, itemsOverride = null) => {
  const items = itemsOverride || parseItems(row.items);
  if (items.length) {
    items.forEach((item) => {
      const variants = parseVariants(item.variants);
      if (variants.length) {
        applyVariantDelta(state.variantMap, variants, sign);
      } else {
        addPlainQuantity(state, getMovementQuantity(item), sign);
      }
    });
    return;
  }

  const variants = parseVariants(row.variants);
  if (variants.length) {
    applyVariantDelta(state.variantMap, variants, sign);
  } else {
    addPlainQuantity(state, getMovementQuantity(row), sign);
  }
};

const applyInventoryReferenceMovement = (state, row, inventoryRefs, sign) => {
  const refs = new Set((inventoryRefs || []).map(Number).filter(Boolean));
  const items = parseItems(row.items);

  if (!items.length) {
    applyMovement(state, row, sign);
    return;
  }

  const matchingItems = items.filter((item) =>
    refs.has(getInventoryReferenceId(item)),
  );

  if (matchingItems.length) {
    applyMovement(state, row, sign, matchingItems);
  }
};

const findInventoryReferences = async (db, catalogProductId, transaction) => {
  const rows = await db.inventoryMaster.findAll({
    where: { productId: catalogProductId },
    attributes: ["Id"],
    transaction,
    raw: true,
  });

  return rows.map((row) => Number(row.Id)).filter(Boolean);
};

const findRepairingStockReferences = async (db, catalogProductId, transaction) => {
  const rows = await db.damageReparingStock.findAll({
    where: { productId: catalogProductId },
    attributes: ["Id"],
    transaction,
    raw: true,
  });

  return rows.map((row) => Number(row.Id)).filter(Boolean);
};

const fetchRows = (model, where, transaction) =>
  model.findAll({ where, transaction, raw: true });

const calculateExpectedInventoryForProduct = async (
  db,
  catalogProductId,
  transaction,
) => {
  const productId = Number(catalogProductId);
  if (!productId) return null;

  const product = await db.product.findOne({
    where: { Id: productId },
    transaction,
  });
  if (!product) return null;

  const inventoryRefs = await findInventoryReferences(db, productId, transaction);
  const repairingRefs = await findRepairingStockReferences(
    db,
    productId,
    transaction,
  );
  const state = {
    plainQuantity: 0,
    variantMap: new Map(),
  };

  const receivedRows = await fetchRows(
    db.receivedProduct,
    { productId },
    transaction,
  );
  receivedRows.forEach((row) => applyMovement(state, row, 1));

  if (inventoryRefs.length) {
    const inventoryRefWhere = { productId: inventoryRefs };
    const [returnRows, inTransitRows, purchaseReturnRows, damageRows] =
      await Promise.all([
        fetchRows(db.returnProduct, inventoryRefWhere, transaction),
        fetchRows(db.inTransitProduct, inventoryRefWhere, transaction),
        fetchRows(db.purchaseReturnProduct, inventoryRefWhere, transaction),
        fetchRows(db.damageProduct, inventoryRefWhere, transaction),
      ]);

    returnRows.forEach((row) => applyMovement(state, row, 1));
    inTransitRows.forEach((row) => applyMovement(state, row, -1));
    purchaseReturnRows.forEach((row) => applyMovement(state, row, -1));
    damageRows.forEach((row) => applyMovement(state, row, -1));

    if (db.posReport) {
      const posRows = await fetchRows(db.posReport, {}, transaction);
      posRows.forEach((row) =>
        applyInventoryReferenceMovement(state, row, inventoryRefs, -1),
      );
    }
  }

  if (repairingRefs.length) {
    const repairedRows = await fetchRows(
      db.damageRepaired,
      { productId: repairingRefs },
      transaction,
    );
    repairedRows.forEach((row) => applyMovement(state, row, 1));
  }

  const calculatedVariants = Array.from(state.variantMap.values()).map(
    (variant) => ({
      ...variant,
      quantity: toNumber(variant.quantity),
    }),
  );
  const negativeVariant = calculatedVariants.find(
    (variant) => variant.quantity < 0,
  );
  if (negativeVariant) {
    throw new Error(
      `Inventory variant cannot be negative: ${negativeVariant.size || ""} ${
        negativeVariant.color || ""
      }`,
    );
  }

  const variants = calculatedVariants.filter((variant) => variant.quantity > 0);
  const quantity = hasVariantRows(variants)
    ? getVariantQuantityTotal(variants)
    : state.plainQuantity;

  return {
    product,
    quantity,
    variants,
  };
};

const reconcileInventoryForProduct = async (db, catalogProductId, transaction) => {
  const productId = Number(catalogProductId);
  if (!productId) return null;

  const expected = await calculateExpectedInventoryForProduct(
    db,
    productId,
    transaction,
  );
  if (!expected) return null;

  let inventory = await db.inventoryMaster.findOne({
    where: { productId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (!inventory) {
    inventory = await db.inventoryMaster.create(
      {
        productId,
        name: expected.product.name,
        sku: "",
        weight: 0,
        quantity: 0,
        variants: [],
        purchase_price: 0,
        sale_price: 0,
      },
      { transaction },
    );
  }

  await inventory.update(
    buildSyncedInventoryStockPayload({
      quantity: expected.quantity,
      variants: expected.variants,
    }),
    { transaction },
  );

  if (Number(expected.product.stockId || 0) !== Number(inventory.Id)) {
    await expected.product.update({ stockId: inventory.Id }, { transaction });
  }

  return inventory;
};

const reconcileInventoryForProducts = async (db, productIds, transaction) => {
  const uniqueProductIds = [
    ...new Set((productIds || []).map(Number).filter(Boolean)),
  ];

  const results = [];
  for (const productId of uniqueProductIds) {
    results.push(await reconcileInventoryForProduct(db, productId, transaction));
  }
  return results;
};

module.exports = {
  calculateExpectedInventoryForProduct,
  reconcileInventoryForProduct,
  reconcileInventoryForProducts,
};

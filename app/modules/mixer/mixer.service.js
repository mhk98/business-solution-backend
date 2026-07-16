const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { MixerSearchableFields } = require("./mixer.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const {
  buildSyncedInventoryStockPayload,
} = require("../../../shared/variantQuantity");
const {
  assertCatalogInventoryMovementVariants,
  assertInventoryVariantStock,
} = require("../../../shared/inventoryVariantGuard");
const {
  toBaseStockPayload,
} = require("../../../helpers/unitConversionHelper");
const { logStockMovement } = require("../../../shared/stockMovementLogger");
const Mixer = db.mixer;
const Notification = db.notification;
const User = db.user;
const ItemMaster = db.itemMaster;
const Product = db.product;
const Manufacturer = db.manufacturer;
const ManufacturerTransaction = db.manufacturerTransaction;
const ManufactureStock = db.manufactureStock;
const InventoryMaster = db.inventoryMaster;
const ReceivedProduct = db.receivedProduct;
const MIXER_META_PREFIX = "\n__MIXER_META__=";

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const calculateMixerWageAmount = (combo, unitWage) =>
  toNumber(combo) * toNumber(unitWage);

const createManufacturerTransaction = async (
  payload = {},
  transaction = null,
) => {
  if (!payload.manufacturerId) return null;
  const debit = toNumber(payload.debit);
  const credit = toNumber(payload.credit);
  if (debit <= 0 && credit <= 0) return null;

  return ManufacturerTransaction.create(
    {
      manufacturerId: payload.manufacturerId,
      manufacturerName: payload.manufacturerName || null,
      mixerId: payload.mixerId || null,
      type: payload.type,
      description: payload.description || null,
      debit,
      credit,
      date: payload.date || new Date().toISOString().slice(0, 10),
      note: payload.note || null,
    },
    { transaction },
  );
};

const reconcileMixerWageTransaction = async (
  previous = {},
  next = {},
  transaction = null,
) => {
  const previousAmount = toNumber(previous.wageAmount);
  const nextAmount = toNumber(next.wageAmount);
  const sameWageInputs =
    toNumber(previous.combo) === toNumber(next.combo) &&
    toNumber(previous.unitWage) === toNumber(next.unitWage);
  if (
    Number(previous.manufacturerId || 0) === Number(next.manufacturerId || 0) &&
    previousAmount === nextAmount &&
    sameWageInputs
  ) {
    return;
  }

  if (previousAmount > 0 && previous.manufacturerId) {
    await createManufacturerTransaction(
      {
        manufacturerId: previous.manufacturerId,
        manufacturerName: previous.manufacturerName,
        mixerId: previous.mixerId,
        type: "MIXER_WAGE_REVERSAL",
        description: `Reverse mixer wage${previous.productName ? ` - ${previous.productName}` : ""}`,
        debit: 0,
        credit: previousAmount,
        date: previous.date,
      },
      transaction,
    );
  }

  if (nextAmount > 0 && next.manufacturerId) {
    await createManufacturerTransaction(
      {
        manufacturerId: next.manufacturerId,
        manufacturerName: next.manufacturerName,
        mixerId: next.mixerId,
        type: "MIXER_WAGE",
        description: `Mixer wage${next.productName ? ` - ${next.productName}` : ""}`,
        debit: nextAmount,
        credit: 0,
        date: next.date,
        note:
          next.unitWage && next.combo
            ? `${toNumber(next.combo)} x ${toNumber(next.unitWage)}`
            : null,
      },
      transaction,
    );
  }
};

const normalizeMaterialName = (value = "") =>
  String(value)
    .replace(/\s+\(Stock:\s*[^)]+\)\s*$/i, "")
    .trim();

const normalizeOutputVariants = (variants) =>
  parseVariants(variants)
    .map((variant) => ({
      size: String(variant?.size || "").trim(),
      color: String(variant?.color || "").trim(),
      quantity: toNumber(variant?.quantity),
      purchase_price: toNumber(variant?.purchase_price),
      sale_price: toNumber(variant?.sale_price),
    }))
    .filter((variant) => variant.size && variant.quantity > 0);

const getOutputQuantity = (combo, variants) => {
  const normalizedVariants = normalizeOutputVariants(variants);
  if (normalizedVariants.length) {
    return normalizedVariants.reduce(
      (total, variant) => total + toNumber(variant.quantity),
      0,
    );
  }

  return toNumber(combo);
};

const getOutputPriceSummary = (variants, purchasePrice = 0, salePrice = 0) => {
  const normalizedVariants = normalizeOutputVariants(variants);

  if (normalizedVariants.length) {
    const quantity = normalizedVariants.reduce(
      (total, variant) => total + toNumber(variant.quantity),
      0,
    );

    if (!quantity) {
      return { purchase_price: 0, sale_price: 0 };
    }

    return {
      purchase_price:
        normalizedVariants.reduce(
          (total, variant) =>
            total + toNumber(variant.quantity) * toNumber(variant.purchase_price),
          0,
        ) / quantity,
      sale_price:
        normalizedVariants.reduce(
          (total, variant) =>
            total + toNumber(variant.quantity) * toNumber(variant.sale_price),
          0,
        ) / quantity,
    };
  }

  return {
    purchase_price: toNumber(purchasePrice),
    sale_price: toNumber(salePrice),
  };
};

const buildMixerNote = (
  note,
  mixItems,
  manufacturer = {},
  variants = [],
  warehouseId = null,
  packagingItems = [],
  outputPrices = {},
) => {
  const displayNote = String(note || "").trim();
  const serializedVariants = normalizeOutputVariants(variants);
  const serializedMixItems = Array.isArray(mixItems)
    ? mixItems
        .map((item) => {
          const value = toNumber(item?.value);
          const quantity = toNumber(item?.quantity);
          const unitValue =
            item?.unitValue === undefined || item?.unitValue === null
              ? value * quantity
              : toNumber(item.unitValue);

          return {
            manufactureId: Number(item?.manufactureId),
            unitValue,
            value,
            quantity,
            unit: item?.unit || "Pcs",
          };
        })
        .filter((item) => item.manufactureId && item.unitValue > 0)
    : [];
  const serializedPackagingItems = Array.isArray(packagingItems)
    ? packagingItems
        .map((item) => {
          const value = toNumber(item?.value);
          const quantity = toNumber(item?.quantity);
          const unitValue =
            item?.unitValue === undefined || item?.unitValue === null
              ? value * quantity
              : toNumber(item.unitValue);

          return {
            itemMasterId: Number(item?.itemMasterId),
            unitValue,
            value,
            quantity,
            unit: item?.unit || "Pcs",
          };
        })
        .filter((item) => item.itemMasterId && item.unitValue > 0)
    : [];

  if (
    !serializedMixItems.length &&
    !serializedPackagingItems.length &&
    !serializedVariants.length &&
    !manufacturer?.manufacturerId &&
    !warehouseId
  ) {
    return displayNote || null;
  }

  return `${displayNote}${MIXER_META_PREFIX}${JSON.stringify({
    mixItems: serializedMixItems,
    packagingItems: serializedPackagingItems,
    manufacturerId: manufacturer?.manufacturerId
      ? Number(manufacturer.manufacturerId)
      : null,
    manufacturerName: manufacturer?.manufacturerName || null,
    stockSource: manufacturer?.manufacturerId ? "manufactureStock" : "itemMaster",
    variants: serializedVariants,
    warehouseId: warehouseId ? Number(warehouseId) : null,
    purchase_price: toNumber(outputPrices.purchase_price),
    sale_price: toNumber(outputPrices.sale_price),
  })}`;
};

const parseMixerNote = (note = "") => {
  const rawNote = String(note || "");
  const metaIndex = rawNote.lastIndexOf(MIXER_META_PREFIX);

  if (metaIndex === -1) {
    return {
      displayNote: rawNote.trim(),
      mixItems: [],
      packagingItems: [],
    };
  }

  const displayNote = rawNote.slice(0, metaIndex).trim();
  const rawMeta = rawNote.slice(metaIndex + MIXER_META_PREFIX.length).trim();

  try {
    const parsedMeta = JSON.parse(rawMeta);
    const manufacturerId = parsedMeta?.manufacturerId
      ? Number(parsedMeta.manufacturerId)
      : null;
    const mixItems = Array.isArray(parsedMeta?.mixItems)
      ? parsedMeta.mixItems
          .map((item) => {
            const unitValue = toNumber(item?.unitValue);
            const value =
              item?.value === undefined || item?.value === null
                ? unitValue
                : toNumber(item.value);
            const quantity =
              item?.quantity === undefined || item?.quantity === null
                ? 1
                : toNumber(item.quantity);

            return {
              manufactureId: Number(item?.manufactureId),
              unitValue,
              value,
              quantity,
              unit: item?.unit || "Pcs",
            };
          })
          .filter((item) => item.manufactureId && item.unitValue > 0)
      : [];
    const packagingItems = Array.isArray(parsedMeta?.packagingItems)
      ? parsedMeta.packagingItems
          .map((item) => {
            const unitValue = toNumber(item?.unitValue);
            const value =
              item?.value === undefined || item?.value === null
                ? unitValue
                : toNumber(item.value);
            const quantity =
              item?.quantity === undefined || item?.quantity === null
                ? 1
                : toNumber(item.quantity);

            return {
              itemMasterId: Number(item?.itemMasterId),
              unitValue,
              value,
              quantity,
              unit: item?.unit || "Pcs",
            };
          })
          .filter((item) => item.itemMasterId && item.unitValue > 0)
      : [];

    return {
      displayNote,
      mixItems,
      packagingItems,
      manufacturerId,
      manufacturerName: parsedMeta?.manufacturerName || null,
      stockSource: parsedMeta?.stockSource || null,
      variants: normalizeOutputVariants(parsedMeta?.variants),
      warehouseId: parsedMeta?.warehouseId ? Number(parsedMeta.warehouseId) : null,
      purchase_price: toNumber(parsedMeta?.purchase_price),
      sale_price: toNumber(parsedMeta?.sale_price),
    };
  } catch (error) {
    return {
      displayNote: rawNote.trim(),
      mixItems: [],
      packagingItems: [],
      manufacturerId: null,
      manufacturerName: null,
      stockSource: null,
      variants: [],
      warehouseId: null,
      purchase_price: 0,
      sale_price: 0,
    };
  }
};

const extractMixerMaterials = (note = "") => {
  return String(note)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const detailedMatch = line.match(
        /^[^:]+:\s*(.+?)\s+x\s*([0-9]+(?:\.[0-9]+)?)$/i,
      );
      const simpleMatch = line.match(/^(.+?):\s*([0-9]+(?:\.[0-9]+)?)$/i);
      const match = detailedMatch || simpleMatch;
      if (!match) return null;

      const name = normalizeMaterialName(
        detailedMatch ? match[1] : match[1] || "",
      );
      const quantity = toNumber(match[2]);
      if (!name || quantity <= 0) return null;

      return { name, quantity };
    })
    .filter(Boolean);
};

const aggregateMixItems = (mixItems = []) => {
  const totals = new Map();

  for (const item of mixItems) {
    const manufactureId = Number(item?.manufactureId);
    const baseStock = toBaseStockPayload(item?.unit || "Pcs", item?.unitValue);
    const unitValue = toNumber(baseStock.unitValue);

    if (!manufactureId || unitValue <= 0) continue;

    totals.set(manufactureId, toNumber(totals.get(manufactureId)) + unitValue);
  }

  return totals;
};

const aggregatePackagingItems = (packagingItems = []) => {
  const totals = new Map();

  for (const item of packagingItems) {
    const itemMasterId = Number(item?.itemMasterId);
    const baseStock = toBaseStockPayload(item?.unit || "Pcs", item?.unitValue);
    const unitValue = toNumber(baseStock.unitValue);

    if (!itemMasterId || unitValue <= 0) continue;

    totals.set(itemMasterId, toNumber(totals.get(itemMasterId)) + unitValue);
  }

  return totals;
};

const getManufacturerById = async (manufacturerId, transaction) => {
  if (!manufacturerId) return null;

  const manufacturer = await Manufacturer.findOne({
    where: { Id: manufacturerId },
    transaction,
  });

  if (!manufacturer) throw new ApiError(404, "Manufacturer not found");
  return manufacturer;
};

const buildManufactureStockWhereOptions = (item, manufacturerId) => {
  const whereOptions = [];
  const base = { manufacturerId };

  if (item?.itemId) {
    whereOptions.push({
      ...base,
      itemId: item.itemId,
      productId: item.productId || null,
      variantKey: item.variantKey || null,
    });
  }

  if (item?.productId) {
    whereOptions.push({
      ...base,
      productId: item.productId,
      name: item.name,
      variantKey: item.variantKey || null,
    });
  }

  whereOptions.push({ ...base, name: item?.name });
  return whereOptions;
};

const findManufactureStockRow = async (item, manufacturerId, transaction) => {
  const whereOptions = buildManufactureStockWhereOptions(item, manufacturerId);

  for (const where of whereOptions) {
    if (!where.name && !where.itemId && !where.productId) continue;

    const stockRow = await ManufactureStock.findOne({
      where,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (stockRow) return stockRow;
  }

  return null;
};

const reconcileManufactureStock = async (
  previousContext,
  nextContext,
  transaction,
  movementContext = null,
) => {
  const previousManufacturerId = Number(previousContext?.manufacturerId || 0);
  const nextManufacturerId = Number(nextContext?.manufacturerId || 0);

  if (!previousManufacturerId && !nextManufacturerId) {
    await reconcileItemMasterStock(
      previousContext?.mixItems || [],
      nextContext?.mixItems || [],
      transaction,
      movementContext,
    );
    return;
  }

  if (
    (previousContext?.mixItems || []).length > 0 &&
    !previousManufacturerId
  ) {
    await reconcileItemMasterStock(
      previousContext.mixItems,
      [],
      transaction,
      movementContext,
    );
  }

  if ((nextContext?.mixItems || []).length > 0 && !nextManufacturerId) {
    await reconcileItemMasterStock(
      [],
      nextContext.mixItems,
      transaction,
      movementContext,
    );
  }

  const totals = new Map();
  const addToTotals = (manufacturerId, mixItems, multiplier) => {
    if (!manufacturerId) return;

    for (const item of mixItems || []) {
      const manufactureId = Number(item?.manufactureId);
      const baseStock = toBaseStockPayload(item?.unit || "Pcs", item?.unitValue);
      const unitValue = toNumber(baseStock.unitValue);
      if (!manufactureId || unitValue <= 0) continue;

      const key = `${manufacturerId}:${manufactureId}`;
      const current = totals.get(key) || {
        manufacturerId,
        manufactureId,
        delta: 0,
      };
      current.delta += multiplier * unitValue;
      totals.set(key, current);
    }
  };

  addToTotals(previousManufacturerId, previousContext?.mixItems || [], 1);
  addToTotals(nextManufacturerId, nextContext?.mixItems || [], -1);

  for (const { manufacturerId, manufactureId, delta } of totals.values()) {
    if (!delta) continue;

    const item = await ItemMaster.findOne({
      where: { Id: manufactureId },
      transaction,
    });

    if (!item) {
      throw new ApiError(
        404,
        `ItemMaster not found for manufactureId ${manufactureId}`,
      );
    }

    const stockRow = await findManufactureStockRow(
      item,
      manufacturerId,
      transaction,
    );

    if (!stockRow) {
      throw new ApiError(404, `${item.name} manufacturer stock not found`);
    }

    const currentStockPayload = toBaseStockPayload(
      stockRow.unit,
      stockRow.unitValue,
    );
    const availableStock = toNumber(currentStockPayload.unitValue);
    const nextStock = availableStock + delta;

    if (nextStock < 0) {
      throw new ApiError(
        400,
        `${stockRow.name} manufacturer stock not enough. Available: ${availableStock}`,
      );
    }

    const updatedStockRow = await stockRow.update(
      {
        unit: currentStockPayload.isConvertedUnit
          ? currentStockPayload.unit
          : stockRow.unit,
        unitValue: nextStock,
      },
      { transaction },
    );
    await logStockMovement({
      transaction,
      ...movementContext,
      stockType: movementContext?.stockType || "FactoryStock",
      stockRow: updatedStockRow,
      itemId: stockRow.itemId,
      productId: stockRow.productId || null,
      manufacturerId,
      name: stockRow.name,
      variant: stockRow.variant,
      variantKey: stockRow.variantKey || null,
      unit: currentStockPayload.isConvertedUnit
        ? currentStockPayload.unit
        : stockRow.unit || "Pcs",
      quantityChange: delta,
      balanceBefore: availableStock,
      balanceAfter: nextStock,
    });
  }
};

const resolveMixItemsFromNote = async (note, transaction) => {
  const materials = extractMixerMaterials(note);
  const resolvedItems = [];

  for (const material of materials) {
    const stockRows = await ItemMaster.findAll({
      where: { name: material.name },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });

    if (stockRows.length !== 1) continue;

    resolvedItems.push({
      manufactureId: Number(stockRows[0].Id),
      unitValue: material.quantity,
    });
  }

  return resolvedItems;
};

const getStoredMixItems = async (mixerRecord, transaction) => {
  const { mixItems } = parseMixerNote(mixerRecord?.note);
  if (mixItems.length) return mixItems;
  return resolveMixItemsFromNote(mixerRecord?.note, transaction);
};

const getStoredStockContext = async (mixerRecord, transaction) => {
  const parsed = parseMixerNote(mixerRecord?.note);
  const mixItems = parsed.mixItems.length
    ? parsed.mixItems
    : await resolveMixItemsFromNote(mixerRecord?.note, transaction);

  return {
    mixItems,
    packagingItems: parsed.packagingItems || [],
    manufacturerId: parsed.manufacturerId || mixerRecord?.manufacturerId || null,
    manufacturerName:
      parsed.manufacturerName || mixerRecord?.manufacturerName || null,
    stockSource: parsed.stockSource || null,
    variants: parsed.variants || [],
    warehouseId: parsed.warehouseId || null,
    purchase_price: parsed.purchase_price || 0,
    sale_price: parsed.sale_price || 0,
    combo: mixerRecord?.combo,
    productId: mixerRecord?.productId,
  };
};

const syncProductStockId = async (productData, stockId, transaction) => {
  if (!productData || !stockId) return;
  if (Number(productData.stockId || 0) === Number(stockId)) return;

  await Product.update(
    { stockId },
    { where: { Id: productData.Id }, transaction },
  );
  productData.stockId = stockId;
};

const buildMixerReceivedProductPayload = ({
  mixerId,
  productData,
  quantity,
  variants,
  purchasePrice,
  salePrice,
  date,
  note,
  warehouseId,
}) => ({
  name: productData.name,
  quantity,
  source: "Mixer",
  batchId: `mixer-${mixerId}`,
  purchase_price: toNumber(purchasePrice),
  sale_price: toNumber(salePrice),
  productId: Number(productData.Id),
  sku: productData.sku || "",
  weight: productData.weight || 0,
  variants: normalizeOutputVariants(variants),
  items: [],
  status: "Active",
  note: note || null,
  date: date || null,
  warehouseId: warehouseId ? Number(warehouseId) : null,
});

const syncMixerReceivedProduct = async ({
  mixerId,
  productData,
  quantity,
  variants,
  purchasePrice,
  salePrice,
  date,
  note,
  warehouseId,
  transaction,
}) => {
  if (!mixerId || !productData?.Id || quantity <= 0) return null;

  const payload = buildMixerReceivedProductPayload({
    mixerId,
    productData,
    quantity,
    variants,
    purchasePrice,
    salePrice,
    date,
    note,
    warehouseId,
  });

  const existing = await ReceivedProduct.findOne({
    where: { source: "Mixer", batchId: `mixer-${mixerId}` },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (existing) {
    return existing.update(payload, { transaction });
  }

  return ReceivedProduct.create(payload, { transaction });
};

const deleteMixerReceivedProduct = async (mixerId, transaction) => {
  if (!mixerId) return 0;

  return ReceivedProduct.destroy({
    where: { source: "Mixer", batchId: `mixer-${mixerId}` },
    transaction,
  });
};

const addMixerOutputToInventory = async (
  productData,
  combo,
  variants,
  purchasePrice,
  salePrice,
  transaction,
  movementContext = null,
) => {
  const productId = Number(productData?.Id || 0);
  const outputVariants = normalizeOutputVariants(variants);
  const quantity = getOutputQuantity(combo, outputVariants);

  if (!productId || quantity <= 0) return;

  const inv = await InventoryMaster.findOne({
    where: { productId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (inv) {
    await assertCatalogInventoryMovementVariants({
      db,
      inventory: inv,
      productId,
      variants: outputVariants,
      quantity,
      transaction,
    });

    const balanceBefore = toNumber(inv.quantity);
    const balanceAfter = balanceBefore + quantity;
    const updatedInventory = await inv.update(
      buildSyncedInventoryStockPayload({
        quantity: balanceAfter,
        variants: mergeVariants(inv.variants, outputVariants),
        purchase_price: toNumber(purchasePrice),
        sale_price: toNumber(salePrice),
      }),
      { transaction },
    );
    await logStockMovement({
      transaction,
      ...movementContext,
      stockType: movementContext?.stockType || "ProductStock",
      stockRow: updatedInventory,
      productId,
      name: productData.name,
      variant: outputVariants,
      unit: "Pcs",
      quantityChange: quantity,
      balanceBefore,
      balanceAfter,
    });

    await syncProductStockId(productData, inv.Id, transaction);
    return;
  }

  await assertCatalogInventoryMovementVariants({
    db,
    inventory: { productId, variants: [] },
    productId,
    variants: outputVariants,
    quantity,
    transaction,
  });

  const stock = await InventoryMaster.create(
    buildSyncedInventoryStockPayload({
      productId,
      sku: productData.sku || "",
      weight: 0,
      name: productData.name,
      quantity,
      variants: outputVariants,
      purchase_price: toNumber(purchasePrice),
      sale_price: toNumber(salePrice),
    }),
    { transaction },
  );
  await logStockMovement({
    transaction,
    ...movementContext,
    stockType: movementContext?.stockType || "ProductStock",
    stockRow: stock,
    productId,
    name: productData.name,
    variant: outputVariants,
    unit: "Pcs",
    quantityChange: quantity,
    balanceBefore: 0,
    balanceAfter: quantity,
  });

  await syncProductStockId(productData, stock.Id, transaction);
};

const removeMixerOutputFromInventory = async (
  context,
  transaction,
  movementContext = null,
) => {
  const productId = Number(context?.productId || 0);
  const quantity = getOutputQuantity(context?.combo, context?.variants);
  if (!productId || quantity <= 0) return;

  const inv = await InventoryMaster.findOne({
    where: { productId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!inv) return;

  const variants = normalizeOutputVariants(context?.variants);
  await assertCatalogInventoryMovementVariants({
    db,
    inventory: inv,
    productId,
    variants,
    quantity,
    transaction,
  });
  assertInventoryVariantStock({ inventory: inv, variants });

  const nextQuantity = toNumber(inv.quantity) - quantity;
  if (nextQuantity < 0) {
    throw new ApiError(400, "Inventory cannot be negative for this mixer");
  }

  const balanceBefore = toNumber(inv.quantity);
  const updatedInventory = await inv.update(
    buildSyncedInventoryStockPayload({
      quantity: nextQuantity,
      variants: subtractVariants(inv.variants, variants),
      purchase_price: toNumber(inv.purchase_price),
      sale_price: toNumber(inv.sale_price),
    }),
    { transaction },
  );
  await logStockMovement({
    transaction,
    ...movementContext,
    stockType: movementContext?.stockType || "ProductStock",
    stockRow: updatedInventory,
    productId,
    name: inv.name,
    variant: variants,
    unit: "Pcs",
    quantityChange: -quantity,
    balanceBefore,
    balanceAfter: nextQuantity,
  });
};

const reconcileItemMasterStock = async (
  previousMixItems,
  nextMixItems,
  transaction,
  movementContext = null,
) => {
  const previousTotals = aggregateMixItems(previousMixItems);
  const nextTotals = aggregateMixItems(nextMixItems);
  const manufactureIds = new Set([
    ...previousTotals.keys(),
    ...nextTotals.keys(),
  ]);

  for (const manufactureId of manufactureIds) {
    const previousQuantity = toNumber(previousTotals.get(manufactureId));
    const nextQuantity = toNumber(nextTotals.get(manufactureId));
    const delta = previousQuantity - nextQuantity;

    if (!delta) continue;

    const stockRow = await ItemMaster.findOne({
      where: { Id: manufactureId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stockRow) {
      throw new ApiError(
        404,
        `ItemMaster not found for manufactureId ${manufactureId}`,
      );
    }

    const currentStockPayload = toBaseStockPayload(
      stockRow.unit,
      stockRow.unitValue,
    );
    const availableStock = toNumber(currentStockPayload.unitValue);

    if (delta < 0 && availableStock < Math.abs(delta)) {
      throw new ApiError(
        400,
        `${stockRow.name} stock not enough. Available: ${availableStock}`,
      );
    }

    const updatedStockRow = await stockRow.update(
      {
        unit: currentStockPayload.isConvertedUnit
          ? currentStockPayload.unit
          : stockRow.unit,
        unitValue: availableStock + delta,
      },
      { transaction },
    );
    await logStockMovement({
      transaction,
      ...movementContext,
      stockType: movementContext?.stockType || "ItemStock",
      stockRow: updatedStockRow,
      itemId: stockRow.itemId,
      productId: stockRow.productId || null,
      name: stockRow.name,
      variant: stockRow.variant,
      variantKey: stockRow.variantKey || null,
      unit: currentStockPayload.isConvertedUnit
        ? currentStockPayload.unit
        : stockRow.unit || "Pcs",
      quantityChange: delta,
      balanceBefore: availableStock,
      balanceAfter: availableStock + delta,
    });
  }
};

const reconcilePackagingStock = async (
  previousPackagingItems,
  nextPackagingItems,
  transaction,
  movementContext = null,
) => {
  const previousTotals = aggregatePackagingItems(previousPackagingItems);
  const nextTotals = aggregatePackagingItems(nextPackagingItems);
  const itemMasterIds = new Set([
    ...previousTotals.keys(),
    ...nextTotals.keys(),
  ]);

  for (const itemMasterId of itemMasterIds) {
    const previousQuantity = toNumber(previousTotals.get(itemMasterId));
    const nextQuantity = toNumber(nextTotals.get(itemMasterId));
    const delta = previousQuantity - nextQuantity;

    if (!delta) continue;

    const stockRow = await ItemMaster.findOne({
      where: { Id: itemMasterId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stockRow) {
      throw new ApiError(
        404,
        `ItemMaster not found for packaging item ${itemMasterId}`,
      );
    }

    const currentStockPayload = toBaseStockPayload(
      stockRow.unit,
      stockRow.unitValue,
    );
    const availableStock = toNumber(currentStockPayload.unitValue);

    if (delta < 0 && availableStock < Math.abs(delta)) {
      throw new ApiError(
        400,
        `${stockRow.name} stock not enough. Available: ${availableStock}`,
      );
    }

    const updatedStockRow = await stockRow.update(
      {
        unit: currentStockPayload.isConvertedUnit
          ? currentStockPayload.unit
          : stockRow.unit,
        unitValue: availableStock + delta,
      },
      { transaction },
    );
    await logStockMovement({
      transaction,
      ...movementContext,
      stockType: movementContext?.stockType || "PackagingStock",
      stockRow: updatedStockRow,
      itemId: stockRow.itemId,
      productId: stockRow.productId || null,
      name: stockRow.name,
      variant: stockRow.variant,
      variantKey: stockRow.variantKey || null,
      unit: currentStockPayload.isConvertedUnit
        ? currentStockPayload.unit
        : stockRow.unit || "Pcs",
      quantityChange: delta,
      balanceBefore: availableStock,
      balanceAfter: availableStock + delta,
    });
  }
};

const sanitizeMixerRecord = (record) => {
  if (!record) return record;

  const {
    displayNote,
    variants,
    warehouseId,
    mixItems,
    packagingItems,
    purchase_price,
    sale_price,
  } = parseMixerNote(record.note);
  if (typeof record.setDataValue === "function") {
    record.setDataValue("note", displayNote || null);
    record.setDataValue("variants", variants || []);
    record.setDataValue("warehouseId", warehouseId || null);
    record.setDataValue("mixItems", mixItems || []);
    record.setDataValue("packagingItems", packagingItems || []);
    record.setDataValue("purchase_price", purchase_price || 0);
    record.setDataValue("sale_price", sale_price || 0);
    record.setDataValue("unitWage", toNumber(record.unitWage));
    record.setDataValue("wageAmount", toNumber(record.wageAmount));
    return record;
  }

  return {
    ...record,
    note: displayNote || null,
    variants: variants || [],
    warehouseId: warehouseId || null,
    mixItems: mixItems || [],
    packagingItems: packagingItems || [],
    purchase_price: purchase_price || 0,
    sale_price: sale_price || 0,
    unitWage: toNumber(record.unitWage),
    wageAmount: toNumber(record.wageAmount),
  };
};

// const insertIntoDB = async (payload) => {
//   console.log("mixer", payload);

//   const { productId, mixItems, date, note } = payload;

//   const productData = await Product.findOne({ where: { Id: productId } });
//   if (!productData) throw new ApiError(404, "Product not found");

//   return db.sequelize.transaction(async (t) => {
//     // 🔹 Update ItemMaster stock
//     if (mixItems?.length) {
//       await decrementItemMasterStock(mixItems, t);
//     }

//     // 🔹 Create mixer record
//     return Mixer.create(
//       {
//         productId,
//         name: productData.name,
//         date,
//         combo,
//         note: finalStatus === "Approved" ? null : note || null,
//       },
//       { transaction: t },
//     );
//   });
// };

const insertIntoDB = async (payload) => {
  console.log("mixer", payload);

  const {
    productId,
    manufacturerId,
    warehouseId,
    mixItems,
    packagingItems,
    date,
    note,
    combo,
    variants,
    purchase_price,
    sale_price,
    unitWage,
  } = payload;

  const productData = await Product.findOne({ where: { Id: productId } });
  if (!productData) throw new ApiError(404, "Product not found");
  const outputVariants = normalizeOutputVariants(variants);
  const outputQuantity = getOutputQuantity(combo, outputVariants);
  const outputPrices = getOutputPriceSummary(
    outputVariants,
    purchase_price,
    sale_price,
  );
  if (outputQuantity <= 0) {
    throw new ApiError(400, "Combo quantity must be greater than 0");
  }
  const wageAmount = calculateMixerWageAmount(outputQuantity, unitWage);

  return db.sequelize.transaction(async (t) => {
    const manufacturer = await getManufacturerById(manufacturerId, t);

    const manufacturerContext = {
      manufacturerId: manufacturer?.Id || null,
      manufacturerName: manufacturer?.name || null,
    };
    const storedNote = buildMixerNote(
      note,
      mixItems,
      manufacturerContext,
      outputVariants,
      warehouseId,
      packagingItems,
      outputPrices,
    );

    const result = await Mixer.create(
      {
        productId,
        name: productData.name,
        manufacturerId: manufacturer?.Id || null,
        manufacturerName: manufacturer?.name || null,
        date,
        combo: outputQuantity,
        unitWage: toNumber(unitWage),
        wageAmount,
        note: storedNote,
      },
      { transaction: t },
    );

    await reconcileMixerWageTransaction(
      {},
      {
        manufacturerId: manufacturer?.Id || null,
        manufacturerName: manufacturer?.name || null,
        mixerId: result.Id,
        productName: productData.name,
        combo: outputQuantity,
        unitWage,
        wageAmount,
        date,
      },
      t,
    );

    await reconcileManufactureStock(
      { mixItems: [], manufacturerId: null },
      { mixItems: mixItems || [], manufacturerId: manufacturer?.Id || null },
      t,
      {
        sourceType: "Mixer",
        sourceId: result.Id,
        operation: "CREATE",
        stockType: "FactoryStock",
      },
    );
    await reconcilePackagingStock([], packagingItems || [], t, {
      sourceType: "Mixer",
      sourceId: result.Id,
      operation: "CREATE",
      stockType: "PackagingStock",
    });
    await addMixerOutputToInventory(
      productData,
      outputQuantity,
      outputVariants,
      outputPrices.purchase_price,
      outputPrices.sale_price,
      t,
      {
        sourceType: "Mixer",
        sourceId: result.Id,
        operation: "CREATE",
        stockType: "ProductStock",
      },
    );

    await syncMixerReceivedProduct({
      mixerId: result.Id,
      productData,
      quantity: outputQuantity,
      variants: outputVariants,
      purchasePrice: outputPrices.purchase_price,
      salePrice: outputPrices.sale_price,
      date,
      note: note || "Generated from Mixer",
      warehouseId,
      transaction: t,
    });

    return sanitizeMixerRecord(result);
  });
};
const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: MixerSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count] = await Promise.all([
    Mixer.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    Mixer.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data: data.map(sanitizeMixerRecord),
  };
};

const getDataById = async (id) => {
  const result = await Mixer.findOne({ where: { Id: id } });
  return sanitizeMixerRecord(result);
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await Mixer.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const existingContext = await getStoredStockContext(existing, t);
    await removeMixerOutputFromInventory(existingContext, t, {
      sourceType: "Mixer",
      sourceId: existing.Id,
      operation: "DELETE",
      stockType: "ProductStock",
    });
    await deleteMixerReceivedProduct(existing.Id, t);
    await reconcileManufactureStock(
      existingContext,
      { mixItems: [], manufacturerId: null },
      t,
      {
        sourceType: "Mixer",
        sourceId: existing.Id,
        operation: "DELETE",
        stockType: "FactoryStock",
      },
    );
    await reconcilePackagingStock(existingContext.packagingItems || [], [], t, {
      sourceType: "Mixer",
      sourceId: existing.Id,
      operation: "DELETE",
      stockType: "PackagingStock",
    });
    await reconcileMixerWageTransaction(
      {
        manufacturerId: existing.manufacturerId,
        manufacturerName: existing.manufacturerName,
        mixerId: existing.Id,
        productName: existing.name,
        wageAmount: existing.wageAmount,
        date: existing.date,
      },
      {},
      t,
    );

    return Mixer.destroy({
      where: { Id: id },
      transaction: t,
    });
  });
};

const updateOneFromDB = async (id, payload) => {
  const {
    productId,
    manufacturerId,
    mixItems,
    packagingItems,
    variants,
    note,
    date,
    status,
    userId,
    actorRole,
    combo,
    warehouseId,
    purchase_price,
    sale_price,
    unitWage,
  } = payload;

  const existing = await Mixer.findOne({
    where: { Id: id },
    attributes: [
      "Id",
      "productId",
      "name",
      "manufacturerId",
      "manufacturerName",
      "note",
      "status",
      "date",
      "combo",
      "unitWage",
      "wageAmount",
    ],
  });

  if (!existing) return 0;

  const { displayNote: oldDisplayNote } = parseMixerNote(existing.note);
  const oldNote = String(oldDisplayNote || "").trim();
  const newNote = String(note || "").trim();
  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
  const dateTriggersPending =
    Boolean(inputDateStr) && inputDateStr !== todayStr;
  const inputStatus = String(status || "").trim();
  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  let finalStatus = existing.status || "Pending";
  if (isPrivileged) {
    finalStatus = inputStatus || finalStatus;
  } else if (dateTriggersPending || noteTriggersPending) {
    finalStatus = "Pending";
  } else {
    finalStatus = inputStatus || finalStatus;
  }

  const nextProductId =
    productId === "" || productId == null ? existing.productId : productId;
  const productData =
    nextProductId && Number(nextProductId) !== Number(existing.productId)
      ? await Product.findOne({ where: { Id: nextProductId } })
      : null;

  if (nextProductId && Number(nextProductId) !== Number(existing.productId)) {
    if (!productData) throw new ApiError(404, "Product not found");
  }

  const updatedCount = await db.sequelize.transaction(async (t) => {
    const lockedMixer = await Mixer.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const previousMixItems = await getStoredMixItems(lockedMixer, t);
    const previousContext = await getStoredStockContext(lockedMixer, t);
    const nextMixItems = Array.isArray(mixItems) ? mixItems : previousMixItems;
    const nextPackagingItems = Array.isArray(packagingItems)
      ? packagingItems
      : previousContext.packagingItems || [];
    const nextVariants =
      variants === undefined
        ? normalizeOutputVariants(previousContext.variants)
        : normalizeOutputVariants(variants);
    const nextOutputPrices = getOutputPriceSummary(
      nextVariants,
      purchase_price === undefined
        ? previousContext.purchase_price
        : purchase_price,
      sale_price === undefined ? previousContext.sale_price : sale_price,
    );
    const nextCombo = getOutputQuantity(
      nextVariants.length ? 0 : combo ?? lockedMixer.combo,
      nextVariants,
    );
    if (nextCombo <= 0) {
      throw new ApiError(400, "Combo quantity must be greater than 0");
    }
    const nextManufacturerId =
      manufacturerId === "" || manufacturerId == null
        ? previousContext.manufacturerId
        : Number(manufacturerId);
    const nextManufacturer =
      nextManufacturerId &&
      (nextManufacturerId !== previousContext.manufacturerId ||
        !previousContext.manufacturerName)
        ? await getManufacturerById(nextManufacturerId, t)
        : nextManufacturerId
          ? {
              Id: nextManufacturerId,
              name:
                previousContext.manufacturerName || lockedMixer.manufacturerName,
            }
          : null;

    const nextUnitWage =
      unitWage === undefined || unitWage === null || unitWage === ""
        ? toNumber(lockedMixer.unitWage)
        : toNumber(unitWage);
    const nextWageAmount = calculateMixerWageAmount(nextCombo, nextUnitWage);

    const nextWarehouseId =
      warehouseId === undefined
        ? previousContext.warehouseId || null
        : Number(warehouseId) || null;

    const finalDisplayNote =
      note === undefined ? oldDisplayNote : String(note || "").trim();

    await reconcileManufactureStock(
      previousContext,
      { mixItems: nextMixItems, manufacturerId: nextManufacturer?.Id || null },
      t,
      {
        sourceType: "Mixer",
        sourceId: lockedMixer.Id,
        operation: "UPDATE",
        stockType: "FactoryStock",
      },
    );
    await reconcilePackagingStock(
      previousContext.packagingItems || [],
      nextPackagingItems,
      t,
      {
        sourceType: "Mixer",
        sourceId: lockedMixer.Id,
        operation: "UPDATE",
        stockType: "PackagingStock",
      },
    );
    await removeMixerOutputFromInventory(previousContext, t, {
      sourceType: "Mixer",
      sourceId: lockedMixer.Id,
      operation: "UPDATE_REVERSE",
      stockType: "ProductStock",
    });
    await deleteMixerReceivedProduct(lockedMixer.Id, t);
    const nextProductData = productData || {
      Id: Number(nextProductId),
      name: lockedMixer.name,
      sku: "",
      weight: 0,
    };
    await addMixerOutputToInventory(
      nextProductData,
      nextCombo,
      nextVariants,
      nextOutputPrices.purchase_price,
      nextOutputPrices.sale_price,
      t,
      {
        sourceType: "Mixer",
        sourceId: lockedMixer.Id,
        operation: "UPDATE_APPLY",
        stockType: "ProductStock",
      },
    );
    await syncMixerReceivedProduct({
      mixerId: lockedMixer.Id,
      productData: nextProductData,
      quantity: nextCombo,
      variants: nextVariants,
      purchasePrice: nextOutputPrices.purchase_price,
      salePrice: nextOutputPrices.sale_price,
      date: inputDateStr || lockedMixer.date || undefined,
      note: finalDisplayNote || "Generated from Mixer",
      warehouseId: nextWarehouseId,
      transaction: t,
    });
    await reconcileMixerWageTransaction(
      {
        manufacturerId: lockedMixer.manufacturerId,
        manufacturerName: lockedMixer.manufacturerName,
        mixerId: lockedMixer.Id,
        productName: lockedMixer.name,
        combo: lockedMixer.combo,
        unitWage: lockedMixer.unitWage,
        wageAmount: lockedMixer.wageAmount,
        date: lockedMixer.date,
      },
      {
        manufacturerId: nextManufacturer?.Id || null,
        manufacturerName: nextManufacturer?.name || null,
        mixerId: lockedMixer.Id,
        productName: nextProductData.name || lockedMixer.name,
        combo: nextCombo,
        unitWage: nextUnitWage,
        wageAmount: nextWageAmount,
        date: inputDateStr || lockedMixer.date || undefined,
      },
      t,
    );

    const storedNote = buildMixerNote(
      finalDisplayNote,
      nextMixItems,
      {
        manufacturerId: nextManufacturer?.Id || null,
        manufacturerName: nextManufacturer?.name || null,
      },
      nextVariants,
      nextWarehouseId,
      nextPackagingItems,
      nextOutputPrices,
    );

    const data = {
      productId: nextProductId || undefined,
      name: productData?.name || lockedMixer.name,
      manufacturerId: nextManufacturer?.Id || null,
      manufacturerName: nextManufacturer?.name || null,
      combo: nextCombo,
      unitWage: nextUnitWage,
      wageAmount: nextWageAmount,
      note: storedNote,
      status: finalStatus,
      date: inputDateStr || lockedMixer.date || undefined,
    };

    const [count] = await Mixer.update(data, {
      where: { Id: id },
      transaction: t,
    });

    return count;
  });

  if (updatedCount <= 0) return updatedCount;

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (!users.length) return updatedCount;

  const message = resolveApprovalNotificationMessage({
    status: finalStatus,
    note: newNote,
    date: inputDateStr,
    approvedMessage: "Mixer request approved",
    fallbackMessage: "Mixer updated",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/mixer`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const data = await Mixer.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(sanitizeMixerRecord);
};

const MixerService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = MixerService;

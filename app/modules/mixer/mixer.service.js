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
const Mixer = db.mixer;
const Notification = db.notification;
const User = db.user;
const ItemMaster = db.itemMaster;
const Product = db.product;
const Manufacturer = db.manufacturer;
const ManufactureStock = db.manufactureStock;
const InventoryMaster = db.inventoryMaster;
const ReceivedProduct = db.receivedProduct;
const MIXER_META_PREFIX = "\n__MIXER_META__=";

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
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

const buildMixerNote = (
  note,
  mixItems,
  manufacturer = {},
  variants = [],
  warehouseId = null,
) => {
  const displayNote = String(note || "").trim();
  const serializedVariants = normalizeOutputVariants(variants);
  const serializedMixItems = Array.isArray(mixItems)
    ? mixItems
        .map((item) => ({
          manufactureId: Number(item?.manufactureId),
          unitValue: toNumber(item?.unitValue),
        }))
        .filter((item) => item.manufactureId && item.unitValue > 0)
    : [];

  if (
    !serializedMixItems.length &&
    !serializedVariants.length &&
    !manufacturer?.manufacturerId &&
    !warehouseId
  ) {
    return displayNote || null;
  }

  return `${displayNote}${MIXER_META_PREFIX}${JSON.stringify({
    mixItems: serializedMixItems,
    manufacturerId: manufacturer?.manufacturerId
      ? Number(manufacturer.manufacturerId)
      : null,
    manufacturerName: manufacturer?.manufacturerName || null,
    stockSource: manufacturer?.manufacturerId ? "manufactureStock" : "itemMaster",
    variants: serializedVariants,
    warehouseId: warehouseId ? Number(warehouseId) : null,
  })}`;
};

const parseMixerNote = (note = "") => {
  const rawNote = String(note || "");
  const metaIndex = rawNote.lastIndexOf(MIXER_META_PREFIX);

  if (metaIndex === -1) {
    return {
      displayNote: rawNote.trim(),
      mixItems: [],
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
          .map((item) => ({
            manufactureId: Number(item?.manufactureId),
            unitValue: toNumber(item?.unitValue),
          }))
          .filter((item) => item.manufactureId && item.unitValue > 0)
      : [];

    return {
      displayNote,
      mixItems,
      manufacturerId,
      manufacturerName: parsedMeta?.manufacturerName || null,
      stockSource: parsedMeta?.stockSource || null,
      variants: normalizeOutputVariants(parsedMeta?.variants),
      warehouseId: parsedMeta?.warehouseId ? Number(parsedMeta.warehouseId) : null,
    };
  } catch (error) {
    return {
      displayNote: rawNote.trim(),
      mixItems: [],
      manufacturerId: null,
      manufacturerName: null,
      stockSource: null,
      variants: [],
      warehouseId: null,
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
    const unitValue = toNumber(item?.unitValue);

    if (!manufactureId || unitValue <= 0) continue;

    totals.set(manufactureId, toNumber(totals.get(manufactureId)) + unitValue);
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
) => {
  const previousManufacturerId = Number(previousContext?.manufacturerId || 0);
  const nextManufacturerId = Number(nextContext?.manufacturerId || 0);

  if (!previousManufacturerId && !nextManufacturerId) {
    await reconcileItemMasterStock(
      previousContext?.mixItems || [],
      nextContext?.mixItems || [],
      transaction,
    );
    return;
  }

  if (
    (previousContext?.mixItems || []).length > 0 &&
    !previousManufacturerId
  ) {
    await reconcileItemMasterStock(previousContext.mixItems, [], transaction);
  }

  if ((nextContext?.mixItems || []).length > 0 && !nextManufacturerId) {
    await reconcileItemMasterStock([], nextContext.mixItems, transaction);
  }

  const totals = new Map();
  const addToTotals = (manufacturerId, mixItems, multiplier) => {
    if (!manufacturerId) return;

    for (const item of mixItems || []) {
      const manufactureId = Number(item?.manufactureId);
      const unitValue = toNumber(item?.unitValue);
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

    const availableStock = toNumber(stockRow.unitValue);
    const nextStock = availableStock + delta;

    if (nextStock < 0) {
      throw new ApiError(
        400,
        `${stockRow.name} manufacturer stock not enough. Available: ${availableStock}`,
      );
    }

    await stockRow.update({ unitValue: nextStock }, { transaction });
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
    manufacturerId: parsed.manufacturerId || mixerRecord?.manufacturerId || null,
    manufacturerName:
      parsed.manufacturerName || mixerRecord?.manufacturerName || null,
    stockSource: parsed.stockSource || null,
    variants: parsed.variants || [],
    warehouseId: parsed.warehouseId || null,
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
  date,
  note,
  warehouseId,
}) => ({
  name: productData.name,
  quantity,
  source: "Mixer",
  batchId: `mixer-${mixerId}`,
  purchase_price: 0,
  sale_price: 0,
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
  transaction,
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

    await inv.update(
      buildSyncedInventoryStockPayload({
        quantity: toNumber(inv.quantity) + quantity,
        variants: mergeVariants(inv.variants, outputVariants),
        purchase_price: toNumber(inv.purchase_price),
        sale_price: toNumber(inv.sale_price),
      }),
      { transaction },
    );

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
      purchase_price: 0,
      sale_price: 0,
    }),
    { transaction },
  );

  await syncProductStockId(productData, stock.Id, transaction);
};

const removeMixerOutputFromInventory = async (context, transaction) => {
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

  await inv.update(
    buildSyncedInventoryStockPayload({
      quantity: nextQuantity,
      variants: subtractVariants(inv.variants, variants),
      purchase_price: toNumber(inv.purchase_price),
      sale_price: toNumber(inv.sale_price),
    }),
    { transaction },
  );
};

const reconcileItemMasterStock = async (
  previousMixItems,
  nextMixItems,
  transaction,
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

    const availableStock = toNumber(stockRow.unitValue);

    if (delta < 0 && availableStock < Math.abs(delta)) {
      throw new ApiError(
        400,
        `${stockRow.name} stock not enough. Available: ${availableStock}`,
      );
    }

    await stockRow.update(
      { unitValue: availableStock + delta },
      { transaction },
    );
  }
};

const sanitizeMixerRecord = (record) => {
  if (!record) return record;

  const { displayNote } = parseMixerNote(record.note);
  const { variants, warehouseId } = parseMixerNote(record.note);
  if (typeof record.setDataValue === "function") {
    record.setDataValue("note", displayNote || null);
    record.setDataValue("variants", variants || []);
    record.setDataValue("warehouseId", warehouseId || null);
    return record;
  }

  return {
    ...record,
    note: displayNote || null,
    variants: variants || [],
    warehouseId: warehouseId || null,
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
    date,
    note,
    combo,
    variants,
  } = payload;

  const productData = await Product.findOne({ where: { Id: productId } });
  if (!productData) throw new ApiError(404, "Product not found");
  const outputVariants = normalizeOutputVariants(variants);
  const outputQuantity = getOutputQuantity(combo, outputVariants);
  if (outputQuantity <= 0) {
    throw new ApiError(400, "Combo quantity must be greater than 0");
  }

  return db.sequelize.transaction(async (t) => {
    const manufacturer = await getManufacturerById(manufacturerId, t);
    if (!manufacturer) throw new ApiError(400, "Please select a manufacturer");

    const manufacturerContext = {
      manufacturerId: manufacturer.Id,
      manufacturerName: manufacturer.name,
    };
    const storedNote = buildMixerNote(
      note,
      mixItems,
      manufacturerContext,
      outputVariants,
      warehouseId,
    );

    await reconcileManufactureStock(
      { mixItems: [], manufacturerId: null },
      { mixItems: mixItems || [], manufacturerId: manufacturer.Id },
      t,
    );
    await addMixerOutputToInventory(productData, outputQuantity, outputVariants, t);

    const result = await Mixer.create(
      {
        productId,
        name: productData.name,
        manufacturerId: manufacturer.Id,
        manufacturerName: manufacturer.name,
        date,
        combo: outputQuantity,
        note: storedNote,
      },
      { transaction: t },
    );

    await syncMixerReceivedProduct({
      mixerId: result.Id,
      productData,
      quantity: outputQuantity,
      variants: outputVariants,
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
    await removeMixerOutputFromInventory(existingContext, t);
    await deleteMixerReceivedProduct(existing.Id, t);
    await reconcileManufactureStock(
      existingContext,
      { mixItems: [], manufacturerId: null },
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
    variants,
    note,
    date,
    status,
    userId,
    actorRole,
    combo,
    warehouseId,
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
    const nextVariants =
      variants === undefined
        ? normalizeOutputVariants(previousContext.variants)
        : normalizeOutputVariants(variants);
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

    if (!nextManufacturer) {
      throw new ApiError(400, "Please select a manufacturer");
    }

    const nextWarehouseId =
      warehouseId === undefined
        ? previousContext.warehouseId || null
        : Number(warehouseId) || null;

    const finalDisplayNote =
      note === undefined ? oldDisplayNote : String(note || "").trim();

    await reconcileManufactureStock(
      previousContext,
      { mixItems: nextMixItems, manufacturerId: nextManufacturer.Id },
      t,
    );
    await removeMixerOutputFromInventory(previousContext, t);
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
      t,
    );
    await syncMixerReceivedProduct({
      mixerId: lockedMixer.Id,
      productData: nextProductData,
      quantity: nextCombo,
      variants: nextVariants,
      date: inputDateStr || lockedMixer.date || undefined,
      note: finalDisplayNote || "Generated from Mixer",
      warehouseId: nextWarehouseId,
      transaction: t,
    });

    const storedNote = buildMixerNote(finalDisplayNote, nextMixItems, {
      manufacturerId: nextManufacturer.Id,
      manufacturerName: nextManufacturer.name,
    }, nextVariants, nextWarehouseId);

    const data = {
      productId: nextProductId || undefined,
      name: productData?.name || lockedMixer.name,
      manufacturerId: nextManufacturer.Id,
      manufacturerName: nextManufacturer.name,
      combo: nextCombo,
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

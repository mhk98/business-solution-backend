const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DamageRepairSearchableFields } = require("./damageRepair.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const DamageRepair = db.damageRepair;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const DamageStock = db.damageStock;
const DamageReparingStock = db.damageReparingStock;
const Variation = db.variation;

const findDamageStockByReference = async (receivedId, transaction) => {
  const byId = await DamageStock.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (byId) return byId;

  return DamageStock.findOne({
    where: { productId: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
};

const findDamageReparingStockByProductId = async (productId, transaction) =>
  DamageReparingStock.findOne({
    where: { productId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

const getVariantKey = (variant) =>
  `${String(variant?.size || "").trim()}__${String(variant?.color || "").trim()}`;

const getVariantQuantityTotal = (variants) =>
  parseVariants(variants).reduce(
    (total, variant) => total + (Number(variant?.quantity) || 0),
    0,
  );

const hasVariantRows = (variants) => parseVariants(variants).length > 0;

const getStockQuantity = (row = {}) =>
  hasVariantRows(row.variants)
    ? getVariantQuantityTotal(row.variants)
    : Number(row.quantity || 0);

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

const getBulkItems = (data = {}) => {
  const items = parseItems(data.items);
  if (!items.length) return [];

  const { items: _items, ...commonFields } = data;
  return items.map((item) => ({
    ...commonFields,
    ...item,
  }));
};

const summarizeItems = (items = []) => ({
  quantity: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
  purchase_price: items.reduce(
    (total, item) => total + Number(item.purchase_price || 0),
    0,
  ),
  sale_price: items.reduce(
    (total, item) => total + Number(item.sale_price || 0),
    0,
  ),
});

const productHasVariations = async (productId, transaction) => {
  if (!productId) return false;

  const count = await Variation.count({
    where: { productId },
    transaction,
  });

  return count > 0;
};

const assertValidVariantSelection = ({
  availableVariants,
  incomingVariants,
  quantity,
}) => {
  const availableRows = parseVariants(availableVariants);
  if (!availableRows.length) return;

  if (!incomingVariants.length) {
    throw new ApiError(400, "Please select variants for this damage stock");
  }

  const incomingTotal = getVariantQuantityTotal(incomingVariants);
  if (incomingTotal !== Number(quantity || 0)) {
    throw new ApiError(400, "Variant quantity must match total quantity");
  }

  const availableByVariant = new Map();
  availableRows.forEach((variant) => {
    availableByVariant.set(
      getVariantKey(variant),
      Number(variant?.quantity || 0),
    );
  });

  incomingVariants.forEach((variant) => {
    const quantity = Number(variant?.quantity || 0);
    const availableQuantity = availableByVariant.get(getVariantKey(variant));

    if (!availableQuantity) {
      throw new ApiError(400, "Selected variant is not available in damage stock");
    }

    if (quantity > availableQuantity) {
      throw new ApiError(400, "Variant quantity exceeds available damage stock");
    }
  });
};

const syncDamageReparingStock = async (
  {
    productId,
    name,
    quantityDelta,
    purchasePriceDelta = 0,
    salePriceDelta = 0,
    variants,
    date,
  },
  transaction,
) => {
  if (!productId || !quantityDelta) return;

  const repairingStock = await findDamageReparingStockByProductId(
    productId,
    transaction,
  );

  if (!repairingStock) {
    if (quantityDelta < 0) {
      throw new ApiError(400, "DamageReparingStock balance cannot be negative");
    }

    await DamageReparingStock.create(
      {
        name,
        productId,
        quantity: quantityDelta,
        purchase_price: Number(purchasePriceDelta || 0),
        sale_price: Number(salePriceDelta || 0),
        variants: variants || [],
        date,
      },
      { transaction },
    );

    return;
  }

  const currentQty = getStockQuantity(repairingStock);
  const nextQty = currentQty + quantityDelta;

  if (nextQty < 0) {
    throw new ApiError(400, "DamageReparingStock balance cannot be negative");
  }

  const nextVariants =
    quantityDelta > 0
      ? mergeVariants(repairingStock.variants, variants)
      : subtractVariants(repairingStock.variants, variants);

  const syncedQty = hasVariantRows(nextVariants)
    ? getVariantQuantityTotal(nextVariants)
    : nextQty;

  await repairingStock.update(
    {
      name: name || repairingStock.name,
      date: date || repairingStock.date,
      quantity: syncedQty,
      purchase_price: Math.max(
        0,
        Number(repairingStock.purchase_price || 0) +
          Number(purchasePriceDelta || 0),
      ),
      sale_price: Math.max(
        0,
        Number(repairingStock.sale_price || 0) + Number(salePriceDelta || 0),
      ),
      variants: nextVariants,
    },
    { transaction },
  );
};

const moveDamageRepairItem = async (item, transaction) => {
  const returnQty = Number(item.quantity);
  const rid = Number(item.receivedId || item.productId);
  const incomingVariants = parseVariants(item.variants);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const received = await findDamageStockByReference(rid, transaction);
  if (!received) throw new ApiError(404, "Received product not found");

  const oldQty = getStockQuantity(received);
  if (oldQty < returnQty) {
    throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
  }

  const damageStockId = Number(received.Id);
  const catalogProductId = Number(received.productId);
  if (!damageStockId) throw new ApiError(400, "DamageStock.Id missing");
  if (!catalogProductId) {
    throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
  }

  const hasProductVariations = await productHasVariations(
    catalogProductId,
    transaction,
  );
  const selectedVariants = hasProductVariations ? incomingVariants : [];

  if (hasProductVariations) {
    assertValidVariantSelection({
      availableVariants: received.variants,
      incomingVariants: selectedVariants,
      quantity: returnQty,
    });
  }

  const perUnitPurchase =
    oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
  const perUnitSale =
    oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;
  const deductPurchase = perUnitPurchase * returnQty;
  const deductSale = perUnitSale * returnQty;

  const finalVariants = hasProductVariations
    ? selectedVariants.length
      ? subtractVariants(received.variants, selectedVariants)
      : received.variants
    : [];
  const finalQuantity = hasVariantRows(finalVariants)
    ? getVariantQuantityTotal(finalVariants)
    : oldQty - returnQty;

  await DamageStock.update(
    {
      quantity: finalQuantity,
      variants: finalVariants,
      purchase_price: Math.max(
        0,
        Number(received.purchase_price || 0) - deductPurchase,
      ),
      sale_price: Math.max(0, Number(received.sale_price || 0) - deductSale),
    },
    { where: { Id: received.Id }, transaction },
  );

  await syncDamageReparingStock(
    {
      productId: catalogProductId,
      name: received.name,
      quantityDelta: returnQty,
      purchasePriceDelta: deductPurchase,
      salePriceDelta: deductSale,
      variants: selectedVariants,
      date: item.date,
    },
    transaction,
  );

  return {
    name: received.name,
    receivedId: damageStockId,
    productId: damageStockId,
    quantity: returnQty,
    variants: selectedVariants,
    purchase_price: deductPurchase,
    sale_price: deductSale,
  };
};

const insertBulkIntoDB = async (data = {}, preparedItems = null) => {
  const items = preparedItems || getBulkItems(data);
  if (!items.length) return null;

  const userId = data.userId ?? items[0]?.userId;
  const supplierId = data.supplierId ?? items[0]?.supplierId;
  const warehouseId = data.warehouseId ?? items[0]?.warehouseId;
  const date = data.date ?? items[0]?.date;
  const note = data.note ?? items[0]?.note;
  const batchId = data.batchId ?? items[0]?.batchId;
  const finalStatus = String(data.status ?? items[0]?.status ?? "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    const normalizedItems = [];
    for (const item of items) {
      normalizedItems.push(await moveDamageRepairItem({ ...item, date }, t));
    }

    const results = [];
    for (const normalizedItem of normalizedItems) {
      const result = await DamageRepair.create(
        {
          name: normalizedItem.name,
          supplierId,
          warehouseId,
          source: "Damage Repair",
          quantity: normalizedItem.quantity,
          variants: normalizedItem.variants,
          items: [],
          batchId: batchId || null,
          purchase_price: normalizedItem.purchase_price,
          sale_price: normalizedItem.sale_price,
          productId: normalizedItem.productId,
          status: finalStatus || "---",
          note: finalStatus === "Approved" ? null : note || null,
          date,
        },
        { transaction: t },
      );
      results.push(result);
    }
    const result = results[0];

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (users.length) {
      const message = resolveApprovalNotificationMessage({
        status: finalStatus,
        note,
        date,
        approvedMessage: "Damage repairing request approved",
        fallbackMessage: "Please approved my request",
      });

      await Promise.all(
        users.map((u) =>
          Notification.create(
            {
              userId: u.Id,
              message,
              url: `/${process.env.APP_BASE_URL}/damage-repair`,
            },
            { transaction: t },
          ),
        ),
      );
    }

    return result;
  });
};

const insertIntoDB = async (data) => {
  const bulkItems = getBulkItems(data);
  if (bulkItems.length) {
    return insertBulkIntoDB(data, bulkItems);
  }

  const {
    quantity,
    receivedId,
    variants,
    date,
    note,
    status,
    userId,
    supplierId,
    warehouseId,
  } = data;

  console.log("Damage", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);
  const incomingVariants = parseVariants(variants);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return await db.sequelize.transaction(async (t) => {
    const received = await findDamageStockByReference(rid, t);

    if (!received) throw new ApiError(404, "Received product not found");

    const oldQty = getStockQuantity(received);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    const perUnitPurchase =
      oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
    const perUnitSale =
      oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    const damageStockId = Number(received.Id);
    if (!damageStockId) {
      throw new ApiError(400, "DamageStock.Id missing");
    }

    const catalogProductId = Number(received.productId);
    if (!catalogProductId) {
      throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
    }

    const hasProductVariations = await productHasVariations(
      catalogProductId,
      t,
    );
    const selectedVariants = hasProductVariations ? incomingVariants : [];

    if (hasProductVariations) {
      assertValidVariantSelection({
        availableVariants: received.variants,
        incomingVariants: selectedVariants,
        quantity: returnQty,
      });
    }

    const result = await DamageRepair.create(
      {
        name: received.name,
        supplierId,
        warehouseId,
        source: "Damage Repair",
        remarks: received.remarks,
        quantity: returnQty,
        variants: selectedVariants,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: damageStockId,
        status: finalStatus || "---",
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
      },
      { transaction: t },
    );

    const finalVariants = hasProductVariations
      ? selectedVariants.length
        ? subtractVariants(received.variants, selectedVariants)
        : received.variants
      : [];
    const finalQuantity = hasVariantRows(finalVariants)
      ? getVariantQuantityTotal(finalVariants)
      : oldQty - returnQty;
    await DamageStock.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
        purchase_price: Math.max(
          0,
          Number(received.purchase_price || 0) - deductPurchase,
        ),
        sale_price: Math.max(0, Number(received.sale_price || 0) - deductSale),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    await syncDamageReparingStock(
      {
        productId: catalogProductId,
        name: received.name,
        quantityDelta: returnQty,
        purchasePriceDelta: deductPurchase,
        salePriceDelta: deductSale,
        variants: selectedVariants,
        date,
      },
      t,
    );

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
    });

    if (users.length) {
      const message = resolveApprovalNotificationMessage({
        status: finalStatus,
        note,
        date,
        approvedMessage: "Received product request approved",
        fallbackMessage: "Please approved my request",
      });

      await Promise.all(
        users.map((u) =>
          Notification.create({
            userId: u.Id,
            message,
            url: `/${process.env.APP_BASE_URL}/purchase-requisition`,
          }),
        ),
      );
    }

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DamageRepairSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await DamageRepair.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["Id", "name"],
      },
      {
        model: Warehouse,
        as: "warehouse",
        attributes: ["Id", "name"],
      },
    ],
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await DamageRepair.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    DamageRepair.count({ where: whereConditions }),
    DamageRepair.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await DamageRepair.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await DamageRepair.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "name",
        "date",
        "productId",
        "quantity",
        "purchase_price",
        "sale_price",
        "variants",
        "items",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");
    const bulkItems = parseItems(ret.items);
    if (bulkItems.length) {
      for (const item of bulkItems) {
        const qty = Number(item.quantity || 0);
        const itemVariants = parseVariants(item.variants);
        const received = await DamageStock.findOne({
          where: { Id: Number(item.productId || item.receivedId) },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!received) throw new ApiError(404, "Received product not found");

        const finalVariants = mergeVariants(received.variants, itemVariants);
        const finalQuantity = hasVariantRows(finalVariants)
          ? getVariantQuantityTotal(finalVariants)
          : Number(received.quantity || 0) + qty;

        await received.update(
          {
            quantity: finalQuantity,
            variants: finalVariants,
            purchase_price:
              Number(received.purchase_price || 0) +
              Number(item.purchase_price || 0),
            sale_price:
              Number(received.sale_price || 0) + Number(item.sale_price || 0),
          },
          { transaction: t },
        );

        await syncDamageReparingStock(
          {
            productId: Number(received.productId),
            name: item.name || received.name,
            quantityDelta: -qty,
            purchasePriceDelta: -Number(item.purchase_price || 0),
            salePriceDelta: -Number(item.sale_price || 0),
            variants: itemVariants,
            date: ret.date,
          },
          t,
        );
      }

      await DamageRepair.destroy({ where: { Id: id }, transaction: t });
      return { deleted: true };
    }

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) ReceivedProduct খুঁজে বের করো (Products.Id দিয়ে)
    const received = await DamageStock.findOne({
      where: { Id: ret.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    const finalVariants = mergeVariants(received.variants, ret.variants);
    const finalQuantity = hasVariantRows(finalVariants)
      ? getVariantQuantityTotal(finalVariants)
      : Number(received.quantity || 0) + qty;
    // 3) stock ফিরিয়ে দাও
    await DamageStock.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
        purchase_price:
          Number(received.purchase_price || 0) +
          Number(ret.purchase_price || 0),
        sale_price:
          Number(received.sale_price || 0) + Number(ret.sale_price || 0),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    await syncDamageReparingStock(
      {
        productId: Number(received.productId),
        name: ret.name,
        quantityDelta: -qty,
        purchasePriceDelta: -Number(ret.purchase_price || 0),
        salePriceDelta: -Number(ret.sale_price || 0),
        variants: parseVariants(ret.variants),
        date: ret.date,
      },
      t,
    );

    // 4) Return row delete
    await DamageRepair.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const {
    quantity,
    receivedId,
    variants,
    note,
    status,
    date,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = data;

  console.log("Damage", data);

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const incomingVariants = parseVariants(variants);
  const nextQty = Number(quantity || 0);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await DamageRepair.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();

  // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

  // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
  const dateTriggersPending =
    Boolean(inputDateStr) && inputDateStr !== todayStr;

  const inputStatus = String(status || "").trim();

  let finalStatus = existing.status || "Pending";

  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  if (isPrivileged) {
    // ✅ superAdmin/admin: যা পাঠাবে সেটাই
    finalStatus = inputStatus || finalStatus;
  } else {
    // ✅ others: today date না হলে বা new note হলে Pending override
    if (dateTriggersPending || noteTriggersPending) {
      finalStatus = "Pending";
    } else {
      // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
      finalStatus = inputStatus || finalStatus;
    }
  }

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    const existing = await DamageRepair.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "name",
        "date",
        "quantity",
        "purchase_price",
        "sale_price",
        "variants",
        "productId",
        "items",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;
    if (parseItems(existing.items).length) {
      throw new ApiError(400, "Bulk damage repairing records cannot be edited");
    }

    const qty = Number(existing.quantity || 0);
    const oldProductId = Number(existing.productId);
    const existingVariants = parseVariants(existing.variants);

    const oldStock = await DamageStock.findOne({
      where: { Id: oldProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldStock) throw new ApiError(404, "DamageStock product not found");

    const restoredOldVariants = mergeVariants(oldStock.variants, existingVariants);
    const restoredOldQuantity = hasVariantRows(restoredOldVariants)
      ? getVariantQuantityTotal(restoredOldVariants)
      : Number(oldStock.quantity || 0) + qty;

    await oldStock.update(
      {
        quantity: restoredOldQuantity,
        purchase_price:
          Number(oldStock.purchase_price || 0) +
          Number(existing.purchase_price || 0),
        sale_price:
          Number(oldStock.sale_price || 0) + Number(existing.sale_price || 0),
        variants: restoredOldVariants,
      },
      { transaction: t },
    );

    const oldCatalogProductId = Number(oldStock.productId);
    if (!oldCatalogProductId) {
      throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
    }

    await syncDamageReparingStock(
      {
        productId: oldCatalogProductId,
        name: existing.name,
        quantityDelta: -qty,
        purchasePriceDelta: -Number(existing.purchase_price || 0),
        salePriceDelta: -Number(existing.sale_price || 0),
        variants: existingVariants,
        date: existing.date,
      },
      t,
    );

    let received = oldStock;
    if (Number(receivedId) !== oldProductId) {
      received = await findDamageStockByReference(rid, t);
    }

    if (!received) throw new ApiError(404, "Received product not found");

    const availableQty = getStockQuantity(received);
    if (availableQty < nextQty) {
      throw new ApiError(400, `Not enough stock. Available: ${availableQty}`);
    }

    const perUnitPurchase =
      availableQty > 0
        ? Number(received.purchase_price || 0) / availableQty
        : 0;
    const perUnitSale =
      availableQty > 0 ? Number(received.sale_price || 0) / availableQty : 0;

    const deductPurchase = perUnitPurchase * nextQty;
    const deductSale = perUnitSale * nextQty;

    const damageStockId = Number(received.Id);
    if (!damageStockId) {
      throw new ApiError(400, "DamageStock.Id missing");
    }

    const catalogProductId = Number(received.productId);
    if (!catalogProductId) {
      throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
    }

    const hasProductVariations = await productHasVariations(
      catalogProductId,
      t,
    );
    const selectedVariants = hasProductVariations ? incomingVariants : [];

    if (hasProductVariations) {
      assertValidVariantSelection({
        availableVariants: received.variants,
        incomingVariants: selectedVariants,
        quantity: nextQty,
      });
    }

    const data = {
      name: received.name,
      supplierId,
      warehouseId,
      remarks: received.remarks,
      quantity: nextQty,
      variants: selectedVariants,
      purchase_price: deductPurchase,
      sale_price: deductSale,
      note: finalStatus === "Approved" ? null : newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
      productId: damageStockId,
    };

    const [updatedCount] = await DamageRepair.update(data, {
      where: { Id: id },
      transaction: t,
    });

    const updatedVariants = hasProductVariations
      ? selectedVariants.length
        ? subtractVariants(received.variants, selectedVariants)
        : received.variants
      : [];
    const stockQuantity = hasVariantRows(updatedVariants)
      ? getVariantQuantityTotal(updatedVariants)
      : availableQty - nextQty;

    await DamageStock.update(
      {
        quantity: stockQuantity,
        purchase_price: Math.max(
          0,
          Number(received.purchase_price || 0) - deductPurchase,
        ),
        sale_price: Math.max(0, Number(received.sale_price || 0) - deductSale),
        variants: updatedVariants,
      },
      { where: { Id: received.Id }, transaction: t },
    );

    await syncDamageReparingStock(
      {
        productId: catalogProductId,
        name: received.name,
        quantityDelta: nextQty,
        purchasePriceDelta: deductPurchase,
        salePriceDelta: deductSale,
        variants: selectedVariants,
        date: inputDateStr || date,
      },
      t,
    );

    // await DamageStock.update(
    //   {
    //     quantity: finalQuantity,
    //     purchase_price: Number(received.purchase_price * finalQuantity || 0),

    //     sale_price:
    //       Number(received.sale_price * finalQuantity || 0) - deductSale,
    //   },
    //   { where: { Id: received.Id }, transaction: t },
    // );

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId }, // sender বাদ
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
      },
    });

    console.log("users", users.length);
    if (!users.length) return updatedCount;

    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
      approvedMessage: "Damage product request approved",
      fallbackMessage: "Damage product updated",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/damage-product`,
        }),
      ),
    );
    return updatedCount;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await DamageRepair.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const DamageRepairService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DamageRepairService;

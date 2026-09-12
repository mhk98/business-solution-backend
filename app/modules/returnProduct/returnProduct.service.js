const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ReturnProductSearchableFields } = require("./returnProduct.constants");
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
const { logStockMovement } = require("../../../shared/stockMovementLogger");
const { resolveUnitPrice } = require("../../../shared/movementUnitPrice");
const fifo = require("../../../shared/fifoCostLayers");
const ReturnProduct = db.returnProduct;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;

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

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const pickFirstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalizeItemVariants = (item = {}) => {
  const variants = parseVariants(item.variants);
  if (variants.length) return variants;

  const size = pickFirstValue(item.size, item.variantSize);
  const color = pickFirstValue(item.color, item.variantColor);
  if (size === undefined && color === undefined) return [];

  return [
    {
      size,
      color,
      quantity: toNumber(item.quantity),
      purchase_price: toNumber(item.purchase_price),
      sale_price: toNumber(item.sale_price),
    },
  ];
};

const summarizeItems = (items = []) => ({
  quantity: items.reduce((total, item) => total + toNumber(item.quantity), 0),
  purchase_price: items.reduce(
    (total, item) => total + toNumber(item.purchase_price),
    0,
  ),
  sale_price: items.reduce(
    (total, item) => total + toNumber(item.sale_price),
    0,
  ),
});

const findInventoryByStoredReference = async (receivedId, transaction) => {
  const inventoryByInventoryId = await InventoryMaster.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (inventoryByInventoryId) return inventoryByInventoryId;

  return InventoryMaster.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
};

const findInventoryByRequestReference = async (receivedId, transaction) => {
  const inventoryByProductId = await InventoryMaster.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (inventoryByProductId) return inventoryByProductId;

  return findInventoryByStoredReference(receivedId, transaction);
};

const moveItemFromInventory = async (item, transaction, date = null) => {
  const returnQty = toNumber(item.quantity);
  const rid = Number(item.receivedId ?? item.productId);
  const incomingVariants = normalizeItemVariants(item);
  const customSalePrice =
    item.sale_price === undefined ||
    item.sale_price === null ||
    item.sale_price === ""
      ? null
      : Number(item.sale_price);

  if (!rid) throw new ApiError(400, "receivedId is required for every item");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0 for every item");
  }
  if (
    customSalePrice !== null &&
    (!Number.isFinite(customSalePrice) || customSalePrice < 0)
  ) {
    throw new ApiError(400, "Sales price must be a positive number");
  }

  const inventory = await findInventoryByRequestReference(rid, transaction);
  if (!inventory) throw new ApiError(404, "Received product not found");
  await assertCatalogInventoryMovementVariants({
    db,
    inventory,
    productId: inventory.productId,
    variants: incomingVariants,
    quantity: returnQty,
    transaction,
  });

  const oldQty = toNumber(inventory.quantity);

  const finalVariants = incomingVariants.length
    ? mergeVariants(inventory.variants, incomingVariants)
    : inventory.variants;

  await inventory.update(
    buildSyncedInventoryStockPayload({
      quantity: oldQty + returnQty,
      variants: finalVariants,
    }),
    { transaction },
  );
  // Sales return: the units re-enter stock at the cost they were sold at.
  // The return form sends `purchase_price`/`sale_price` as LINE TOTALS
  // (unit price × quantity), same as receivedProduct's totals — not per-unit
  // like the received-product form. mode: "total" divides by quantity to
  // get the real per-unit cost; using "unit" here was stamping the full line
  // total as if it were per-unit, inflating every restored FIFO layer's cost
  // by a factor of quantity.
  const priceRow = {
    variants: incomingVariants,
    quantity: returnQty,
    purchase_price: toNumber(item.purchase_price),
    sale_price:
      customSalePrice !== null ? customSalePrice : toNumber(item.sale_price),
  };
  const returnUnitSale = resolveUnitPrice(priceRow, "sale_price", {
    mode: "total",
  });
  let returnUnitCost = resolveUnitPrice(priceRow, "purchase_price", {
    mode: "total",
  });
  // No invented cost — if the return form did not carry a unit cost it stays 0
  // ("cost not recorded"); the user can set it later.
  const returnMovement = await logStockMovement({
    transaction,
    sourceType: "ReturnProduct",
    operation: "CREATE",
    stockType: "ProductStock",
    productId: inventory.productId,
    name: inventory.name,
    unit: "Pcs",
    date,
    quantityChange: returnQty,
    balanceBefore: oldQty,
    balanceAfter: oldQty + returnQty,
    unitSalePrice: returnUnitSale,
    unitCostConsumed: returnUnitCost,
  });
  await fifo.returnToStock({
    transaction,
    productId: inventory.productId,
    quantity: returnQty,
    unitCost: returnUnitCost,
    variants: incomingVariants,
    receivedDate: date,
    sourceMovementId: returnMovement ? returnMovement.Id : null,
  });

  return {
    receivedId: rid,
    productId: Number(inventory.Id),
    name: inventory.name,
    quantity: returnQty,
    variants: incomingVariants,
    purchase_price: toNumber(item.purchase_price),
    sale_price:
      customSalePrice !== null ? customSalePrice : toNumber(item.sale_price),
    fifo_cost: round2(returnQty * returnUnitCost),
  };
};

const restoreItemsToInventory = async (items = [], transaction) => {
  for (const item of items) {
    const inventory = await findInventoryByStoredReference(
      Number(item.productId ?? item.receivedId),
      transaction,
    );

    if (!inventory) throw new ApiError(404, "Received product not found");
    await assertCatalogInventoryMovementVariants({
      db,
      inventory,
      productId: inventory.productId,
      variants: item.variants,
      quantity: item.quantity,
      transaction,
    });
    assertInventoryVariantStock({
      inventory,
      variants: item.variants,
    });

    const restoreBalanceBefore = toNumber(inventory.quantity);
    const restoreQty = toNumber(item.quantity);
    const nextQuantity = restoreBalanceBefore - restoreQty;
    if (nextQuantity < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }

    await inventory.update(
      buildSyncedInventoryStockPayload({
        quantity: nextQuantity,
        variants: subtractVariants(
          inventory.variants,
          parseVariants(item.variants),
        ),
      }),
      { transaction },
    );
    await logStockMovement({
      transaction,
      sourceType: "ReturnProduct",
      operation: "REVERSE",
      stockType: "ProductStock",
      productId: inventory.productId,
      name: inventory.name,
      unit: "Pcs",
      quantityChange: -restoreQty,
      balanceBefore: restoreBalanceBefore,
      balanceAfter: nextQuantity,
    });
    // Undo the layer this sales-return had opened (newest first).
    await fifo.unwindForRow({
      transaction,
      productId: inventory.productId,
      quantity: restoreQty,
      variants: parseVariants(item.variants),
    });
  }
};

const insertIntoDB = async (data) => {
  const bulkItems = getBulkItems(data);
  if (bulkItems.length) {
    return insertBulkIntoDB(data, bulkItems);
  }

  const {
    quantity,
    sale_price,
    purchase_price,
    receivedId,
    variants,
    date,
    note,
    status,
    userId,
    supplierId,
    warehouseId,
    batchId,
  } = data;

  console.log("Return", data);

  const returnQty = Number(quantity);
  const customSalePrice =
    sale_price === undefined || sale_price === null || sale_price === ""
      ? null
      : Number(sale_price);
  const rid = Number(receivedId);
  const incomingVariants = parseVariants(variants);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }
  if (
    customSalePrice !== null &&
    (!Number.isFinite(customSalePrice) || customSalePrice < 0)
  ) {
    throw new ApiError(400, "Sales price must be a positive number");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return await db.sequelize.transaction(async (t) => {
    const inventory = await findInventoryByRequestReference(rid, t);

    if (!inventory) throw new ApiError(404, "Received product not found");
    await assertCatalogInventoryMovementVariants({
      db,
      inventory,
      productId: inventory.productId,
      variants: incomingVariants,
      quantity: returnQty,
      transaction: t,
    });

    const oldQty = Number(inventory.quantity || 0);
    // if (oldQty < returnQty) {
    //   throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    // }

    // const perUnitPurchase =
    //   oldQty > 0 ? Number(inventory.purchase_price || 0) / oldQty : 0;
    // const perUnitSale =
    //   oldQty > 0 ? Number(inventory.sale_price || 0) / oldQty : 0;

    // const deductPurchase = perUnitPurchase * returnQty;
    // const deductSale = perUnitSale * returnQty;

    const inventoryId = Number(inventory.Id);
    if (!inventoryId) {
      throw new ApiError(400, "InventoryMaster.Id missing");
    }

    const result = await ReturnProduct.create(
      {
        name: inventory.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        variants: incomingVariants,
        source: "Sales Return Product",
        batchId: batchId || null,
        purchase_price: Number(purchase_price),
        sale_price:
          customSalePrice !== null ? customSalePrice : Number(sale_price),
        productId: inventoryId,
        status: finalStatus || "---",
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
      },
      { transaction: t },
    );

    const finalQuantity = oldQty + returnQty;
    const finalVariants = incomingVariants.length
      ? mergeVariants(inventory.variants, incomingVariants)
      : inventory.variants;
    await InventoryMaster.update(
      buildSyncedInventoryStockPayload({
        quantity: finalQuantity,
        variants: finalVariants,
        // purchase_price: Number(inventory.purchase_price * finalQuantity),
        // sale_price: Number(inventory.sale_price * finalQuantity),
      }),
      { where: { Id: inventory.Id }, transaction: t },
    );
    // Same line-total (not per-unit) shape as the bulk-return path above —
    // see the comment there.
    const directReturnUnitSale = resolveUnitPrice(
      {
        variants: incomingVariants,
        quantity: returnQty,
        sale_price:
          customSalePrice !== null ? customSalePrice : Number(sale_price),
      },
      "sale_price",
      { mode: "total" },
    );
    let directReturnUnitCost = resolveUnitPrice(
      {
        variants: incomingVariants,
        quantity: returnQty,
        purchase_price: Number(purchase_price),
      },
      "purchase_price",
      { mode: "total" },
    );
    // No invented cost — 0 stays 0 when the return form has no unit cost.
    const directReturnMovement = await logStockMovement({
      transaction: t,
      sourceType: "ReturnProduct",
      sourceId: result.Id,
      operation: "CREATE",
      stockType: "ProductStock",
      productId: inventory.productId,
      name: inventory.name,
      unit: "Pcs",
      date,
      quantityChange: returnQty,
      balanceBefore: oldQty,
      balanceAfter: finalQuantity,
      unitSalePrice: directReturnUnitSale,
      unitCostConsumed: directReturnUnitCost,
    });
    await fifo.returnToStock({
      transaction: t,
      productId: inventory.productId,
      quantity: returnQty,
      unitCost: directReturnUnitCost,
      variants: incomingVariants,
      receivedDate: date,
      sourceMovementId: directReturnMovement ? directReturnMovement.Id : null,
    });
    await result.update(
      { fifo_cost: round2(returnQty * directReturnUnitCost) },
      { transaction: t },
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

const insertBulkIntoDB = async (data = {}, preparedItems = null) => {
  const items = preparedItems || getBulkItems(data);
  if (!items.length) return insertIntoDB(data);

  const firstItem = items[0] || {};
  const userId = data.userId ?? firstItem.userId;
  const date = data.date ?? firstItem.date;
  const status = data.status ?? firstItem.status;
  const note = data.note ?? firstItem.note;
  const supplierId = data.supplierId ?? firstItem.supplierId;
  const warehouseId = data.warehouseId ?? firstItem.warehouseId;
  const batchId = data.batchId ?? firstItem.batchId;
  const finalStatus = String(status || "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    const normalizedItems = [];

    for (const item of items) {
      normalizedItems.push(await moveItemFromInventory(item, t));
    }

    const results = [];
    for (const normalizedItem of normalizedItems) {
      const result = await ReturnProduct.create(
        {
          name: normalizedItem.name,
          supplierId,
          warehouseId,
          quantity: normalizedItem.quantity,
          variants: normalizedItem.variants,
          items: [],
          source: "Sales Return Product",
          batchId: batchId || null,
          purchase_price: normalizedItem.purchase_price,
          sale_price: normalizedItem.sale_price,
          fifo_cost: normalizedItem.fifo_cost,
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
        approvedMessage: "Received product request approved",
        fallbackMessage: "Please approved my request",
      });

      await Promise.all(
        users.map((u) =>
          Notification.create(
            {
              userId: u.Id,
              message,
              url: `/${process.env.APP_BASE_URL}/purchase-requisition`,
            },
            { transaction: t },
          ),
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
      [Op.or]: ReturnProductSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
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

  const result = await ReturnProduct.findAll({
    where: whereConditions,
    offset: skip,
    limit,
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
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await ReturnProduct.count({ where: whereConditions });
  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    ReturnProduct.count({ where: whereConditions }),
    ReturnProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await ReturnProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  await fifo.assertNotClosedPeriod({
    sourceType: "ReturnProduct",
    sourceId: id,
  });
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await ReturnProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "productId", "quantity", "variants", "items"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const returnItems = parseItems(ret.items);
    if (returnItems.length > 0) {
      await restoreItemsToInventory(returnItems, t);

      await ReturnProduct.destroy({
        where: { Id: id },
        transaction: t,
      });

      return { deleted: true };
    }

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) InventoryMaster খুঁজে বের করো (Products.Id দিয়ে)
    const received = await findInventoryByStoredReference(
      Number(ret.productId),
      t,
    );

    if (!received) throw new ApiError(404, "Received product not found");
    await assertCatalogInventoryMovementVariants({
      db,
      inventory: received,
      productId: received.productId,
      variants: ret.variants,
      quantity: qty,
      transaction: t,
    });
    assertInventoryVariantStock({
      inventory: received,
      variants: ret.variants,
    });

    const deleteBalanceBefore = Number(received.quantity || 0);
    const finalQuantity = deleteBalanceBefore - qty;
    if (finalQuantity < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }

    const retVariants = parseVariants(ret.variants);
    const finalVariants = retVariants.length
      ? subtractVariants(received.variants, retVariants)
      : received.variants;

    // 3) stock ফিরিয়ে নেওয়া হবে InventoryMaster থেকে
    await InventoryMaster.update(
      buildSyncedInventoryStockPayload({
        quantity: finalQuantity,
        variants: finalVariants,
        // purchase_price: Number(received.purchase_price * finalQuantity),
        // sale_price: Number(received.sale_price * finalQuantity),
      }),
      { where: { Id: received.Id }, transaction: t },
    );
    await logStockMovement({
      transaction: t,
      sourceType: "ReturnProduct",
      sourceId: id,
      operation: "DELETE",
      stockType: "ProductStock",
      productId: received.productId,
      name: received.name,
      unit: "Pcs",
      quantityChange: -qty,
      balanceBefore: deleteBalanceBefore,
      balanceAfter: finalQuantity,
    });
    await fifo.unwindForRow({
      transaction: t,
      productId: received.productId,
      quantity: qty,
      variants: retVariants,
    });

    // 4) Return row delete
    await ReturnProduct.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

// const updateOneFromDB = async (id, payload) => {
//   const {
//     quantity,
//     receivedId,
//     note,
//     status,
//     date,
//     userId,
//     supplierId,
//     warehouseId,
//     actorRole,
//   } = payload;

//   const productData = await Product.findOne({
//     where: { Id: receivedId },
//   });

//   if (!productData) throw new ApiError(404, "Product not found");

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   return db.sequelize.transaction(async (t) => {
//     // ✅ existing (lock)
//     const existing = await ReturnProduct.findOne({
//       where: { Id: id },
//       attributes: ["Id", "note", "status", "quantity", "requestedQuantity"],
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!existing) return 0;

//     const oldStatus = String(existing.status || "").trim();
//     const oldNote = String(existing.note || "").trim();
//     const newNote = String(note || "").trim();

//     const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
//     const dateTriggersPending =
//       Boolean(inputDateStr) && inputDateStr !== todayStr;

//     const inputStatus = String(status || "").trim();
//     const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

//     let finalStatus = existing.status || "Pending";

//     if (isPrivileged) {
//       finalStatus = inputStatus || finalStatus;
//     } else {
//       finalStatus = "Pending"; // ✅ অন্য actorRole হলে always Pending
//     }

//     const newStatus = String(finalStatus || "").trim();

//     // ✅ কোন quantity টা এখন apply হবে?
//     // - Inventor: শুধু requestedQuantity সেট করবে, main quantity বদলাবে না
//     // - Admin যখন Approved/Active করবে: requestedQuantity থাকলে সেটাই apply হবে
//     const isStockStatus = (s) => s === "Approved" || s === "Active";

//     const requestedQty = Number(quantity || 0);

//     console.log("requestedQty", requestedQty);

//     const appliedQty =
//       isPrivileged && isStockStatus(newStatus)
//         ? Number(existing.requestedQuantity ?? requestedQty) // approve হলে requestedQuantity priority
//         : Number(existing.quantity || 0); // inventor/pending হলে quantity unchanged

//     const message =
//       newStatus === "Approved"
//         ? "Purchase  product request approved"
//         : newNote || "Please approved my request";

//     // ✅ data (ReturnProduct)
//     const data = {
//       name: productData.name,
//       supplierId,
//       warehouseId,
//       productId: receivedId,
//       note: finalStatus === "Approved" ? null : newNote || null,
//       status: finalStatus,
//       date: inputDateStr || undefined,
//     };

//     if (isPrivileged && isStockStatus(newStatus)) {
//       // ✅ approve/active হলে main quantity আপডেট হবে
//       data.quantity = appliedQty;
//       data.purchase_price = productData.purchase_price * appliedQty;
//       data.sale_price = productData.sale_price * appliedQty;

//       // ✅ approve হয়ে গেলে request clear করে দাও
//       data.requestedQuantity = null;
//     } else {
//       // ✅ inventor/other role হলে main quantity বদলাবে না
//       // শুধু request জমা হবে
//       data.quantity = Number(existing.quantity || 0);
//       data.purchase_price =
//         productData.purchase_price * Number(existing.quantity || 0);
//       data.sale_price = productData.sale_price * Number(existing.quantity || 0);

//       // inventor edit করলে requestedQuantity সেট হবে (admin approve করার জন্য)
//       data.requestedQuantity = requestedQty;
//     }

//     // ✅ InventoryMaster update হবে শুধু admin/superAdmin + Approved/Active হলে
//     const shouldUpdateInventory = isPrivileged && isStockStatus(newStatus);

//     if (shouldUpdateInventory) {
//       // ----- ✅ তোমার calculation ব্লক (unchanged) -----
//       const qty = Number(existing.quantity || 0); // old applied qty (e.g. 100)
//       const quantityToApply = Number(appliedQty || 0); // new applied qty (e.g. 80)

//       let receivedFinalQty = 0;
//       if (Number(qty) > Number(quantityToApply)) {
//         receivedFinalQty = Number(qty) - Number(quantityToApply);
//       } else {
//         receivedFinalQty = Number(quantityToApply) - Number(qty);
//       }

//       const inv = await InventoryMaster.findOne({
//         where: { productId: receivedId },
//         transaction: t,
//         lock: t.LOCK.UPDATE,
//       });

//       if (inv) {
//         let stockQuantity = 0;
//         if (Number(qty) > Number(quantityToApply)) {
//           stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
//         } else {
//           stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
//         }

//         if (stockQuantity < 0)
//           throw new ApiError(400, "Inventory cannot be negative");

//         const oldQty = Number(inv.quantity);

//         const perUnitPurchase =
//           oldQty > 0 ? Number(inv.purchase_price || 0) / oldQty : 0;
//         const perUnitSale =
//           oldQty > 0 ? Number(inv.sale_price || 0) / oldQty : 0;

//         await inv.update(
//           {
//             quantity: stockQuantity,
//             purchase_price: perUnitPurchase * stockQuantity,
//             sale_price: perUnitSale * stockQuantity,
//           },
//           { transaction: t },
//         );
//       }
//       // ----- ✅ calculation ব্লক end -----
//     }

//     const [updatedCount] = await ReturnProduct.update(data, {
//       where: { Id: id },
//       transaction: t,
//     });

//     const users = await User.findAll({
//       attributes: ["Id", "role"],
//       where: {
//         Id: { [Op.ne]: userId },
//         role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
//       },
//       transaction: t,
//     });

//     if (!users.length) return updatedCount;

//     await Promise.all(
//       users.map((u) =>
//         Notification.create(
//           {
//             userId: u.Id,
//             message,
//             url: `/${process.env.APP_BASE_URL}/purchase-return`,
//           },
//           { transaction: t },
//         ),
//       ),
//     );

//     return updatedCount;
//   });
// };

const updateBulkOneFromDB = async (id, payload, preparedItems = []) => {
  const { note, status, date, userId, supplierId, warehouseId, actorRole } =
    payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  return db.sequelize.transaction(async (t) => {
    const existing = await ReturnProduct.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "note",
        "status",
        "quantity",
        "sale_price",
        "variants",
        "productId",
        "items",
        "batchId",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const oldNote = String(existing.note || "").trim();
    const newNote = String(note || "").trim();
    const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
    const dateTriggersPending =
      Boolean(inputDateStr) && inputDateStr !== todayStr;

    const inputStatus = String(status || "").trim();
    let finalStatus = existing.status || "Pending";
    const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

    if (isPrivileged) {
      finalStatus = inputStatus || finalStatus;
    } else if (dateTriggersPending || noteTriggersPending) {
      finalStatus = "Pending";
    } else {
      finalStatus = inputStatus || finalStatus;
    }

    const oldItems = parseItems(existing.items);
    const restoreItems = oldItems.length
      ? oldItems
      : [
          {
            productId: existing.productId,
            receivedId: existing.productId,
            quantity: existing.quantity,
            variants: existing.variants,
          },
        ];

    await restoreItemsToInventory(restoreItems, t);

    const nextItems = preparedItems.length ? preparedItems : oldItems;
    const normalizedItems = [];
    for (const item of nextItems) {
      normalizedItems.push(await moveItemFromInventory(item, t));
    }

    // Delete the old single bulk row and create separate rows per item
    await ReturnProduct.destroy({ where: { Id: id }, transaction: t });

    const resolvedBatchId = existing.batchId || `batch-${Date.now()}`;
    for (const normalizedItem of normalizedItems) {
      await ReturnProduct.create(
        {
          name: normalizedItem.name,
          supplierId,
          warehouseId,
          quantity: normalizedItem.quantity,
          variants: normalizedItem.variants,
          items: [],
          source: "Sales Return Product",
          batchId: resolvedBatchId,
          purchase_price: normalizedItem.purchase_price,
          sale_price: normalizedItem.sale_price,
          fifo_cost: normalizedItem.fifo_cost,
          productId: normalizedItem.productId,
          note: finalStatus === "Approved" ? null : newNote || null,
          status: finalStatus,
          date: inputDateStr || undefined,
        },
        { transaction: t },
      );
    }
    const updatedCount = normalizedItems.length;

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (!users.length) return updatedCount;

    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
      approvedMessage: "Received product request approved",
      fallbackMessage: "Please approved my request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create(
          {
            userId: u.Id,
            message,
            url: `/${process.env.APP_BASE_URL}/purchase-requisition`,
          },
          { transaction: t },
        ),
      ),
    );

    return updatedCount;
  });
};

const updateOneFromDB = async (id, payload) => {
  await fifo.assertNotClosedPeriod({
    sourceType: "ReturnProduct",
    sourceId: id,
  });
  const incomingBulkItems = getBulkItems(payload);
  if (incomingBulkItems.length) {
    return updateBulkOneFromDB(id, payload, incomingBulkItems);
  }

  const existingItemsRow = await ReturnProduct.findOne({
    where: { Id: id },
    attributes: ["Id", "items"],
  });
  if (parseItems(existingItemsRow?.items).length > 0) {
    return updateBulkOneFromDB(id, payload, incomingBulkItems);
  }

  const {
    quantity,
    purchase_price,
    sale_price,
    receivedId,
    variants,
    note,
    status,
    date,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const incomingVariants = parseVariants(variants);
  const nextQty = toNumber(quantity);
  const customSalePrice =
    sale_price === undefined || sale_price === null || sale_price === ""
      ? null
      : Number(sale_price);
  if (
    customSalePrice !== null &&
    (!Number.isFinite(customSalePrice) || customSalePrice < 0)
  ) {
    throw new ApiError(400, "Sales price must be a positive number");
  }

  return db.sequelize.transaction(async (t) => {
    // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
    const existing = await ReturnProduct.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "note",
        "status",
        "quantity",
        "sale_price",
        "variants",
        "productId",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const oldQty = toNumber(existing.quantity);
    const oldProductId = Number(existing.productId);
    const newProductId = receivedId ? Number(receivedId) : oldProductId;
    const productChanged = newProductId !== oldProductId;
    const existingVariants = parseVariants(existing.variants);
    const oldNote = String(existing.note || "").trim();
    const newNote = String(note || "").trim();

    const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
    const dateTriggersPending =
      Boolean(inputDateStr) && inputDateStr !== todayStr;

    const inputStatus = String(status || "").trim();
    let finalStatus = existing.status || "Pending";
    const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

    if (isPrivileged) {
      finalStatus = inputStatus || finalStatus;
    } else {
      if (dateTriggersPending || noteTriggersPending) {
        finalStatus = "Pending";
      } else {
        finalStatus = inputStatus || finalStatus;
      }
    }

    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
      approvedMessage: "Purchase product request approved",
      fallbackMessage: "Please approved my request",
    });

    const oldInv = await InventoryMaster.findOne({
      where: { Id: oldProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldInv) throw new ApiError(404, "Inventory product not found");

    let targetInv = oldInv;

    if (productChanged) {
      // undo old return from old product
      await assertCatalogInventoryMovementVariants({
        db,
        inventory: oldInv,
        productId: oldInv.productId,
        variants: existingVariants,
        quantity: oldQty,
        transaction: t,
      });
      assertInventoryVariantStock({
        inventory: oldInv,
        variants: existingVariants,
      });
      const oldBalanceBefore = toNumber(oldInv.quantity);
      const oldInventoryQuantity = oldBalanceBefore - oldQty;
      if (oldInventoryQuantity < 0) {
        throw new ApiError(400, "Inventory cannot be negative");
      }

      await oldInv.update(
        buildSyncedInventoryStockPayload({
          quantity: oldInventoryQuantity,
          variants: existingVariants.length
            ? subtractVariants(oldInv.variants, existingVariants)
            : oldInv.variants,
        }),
        { transaction: t },
      );
      await logStockMovement({
        transaction: t,
        sourceType: "ReturnProduct",
        sourceId: id,
        operation: "UPDATE",
        stockType: "ProductStock",
        productId: oldInv.productId,
        name: oldInv.name,
        unit: "Pcs",
        date: inputDateStr || null,
        quantityChange: -oldQty,
        balanceBefore: oldBalanceBefore,
        balanceAfter: oldInventoryQuantity,
      });

      targetInv = await findInventoryByRequestReference(newProductId, t);
      if (!targetInv) throw new ApiError(404, "Product not found in inventory");
      await assertCatalogInventoryMovementVariants({
        db,
        inventory: targetInv,
        productId: targetInv.productId,
        variants: incomingVariants,
        quantity: nextQty,
        transaction: t,
      });

      // apply new return to new product
      const targetBalanceBefore = toNumber(targetInv.quantity);
      await targetInv.update(
        buildSyncedInventoryStockPayload({
          quantity: targetBalanceBefore + nextQty,
          variants: incomingVariants.length
            ? mergeVariants(targetInv.variants, incomingVariants)
            : targetInv.variants,
        }),
        { transaction: t },
      );
      await logStockMovement({
        transaction: t,
        sourceType: "ReturnProduct",
        sourceId: id,
        operation: "UPDATE",
        stockType: "ProductStock",
        productId: targetInv.productId,
        name: targetInv.name,
        unit: "Pcs",
        date: inputDateStr || null,
        quantityChange: nextQty,
        balanceBefore: targetBalanceBefore,
        balanceAfter: targetBalanceBefore + nextQty,
      });
    } else {
      const diff = nextQty - oldQty;
      await assertCatalogInventoryMovementVariants({
        db,
        inventory: oldInv,
        productId: oldInv.productId,
        variants: incomingVariants.length ? incomingVariants : existingVariants,
        quantity: incomingVariants.length ? nextQty : oldQty,
        transaction: t,
      });

      let updatedVariants = oldInv.variants;
      if (existingVariants.length > 0 || incomingVariants.length > 0) {
        await assertCatalogInventoryMovementVariants({
          db,
          inventory: oldInv,
          productId: oldInv.productId,
          variants: incomingVariants,
          quantity: nextQty,
          transaction: t,
        });
        // undo old return's contribution, then apply new return's contribution
        const withOldRemoved = existingVariants.length
          ? subtractVariants(oldInv.variants, existingVariants)
          : oldInv.variants;
        updatedVariants = incomingVariants.length
          ? mergeVariants(withOldRemoved, incomingVariants)
          : withOldRemoved;
      }

      const sameProductBalanceBefore = toNumber(oldInv.quantity);
      const nextInventoryQuantity = sameProductBalanceBefore + diff;
      if (nextInventoryQuantity < 0) {
        throw new ApiError(400, "Inventory cannot be negative");
      }

      await oldInv.update(
        buildSyncedInventoryStockPayload({
          quantity: nextInventoryQuantity,
          variants: updatedVariants,
        }),
        { transaction: t },
      );
      if (diff) {
        await logStockMovement({
          transaction: t,
          sourceType: "ReturnProduct",
          sourceId: id,
          operation: "UPDATE",
          stockType: "ProductStock",
          productId: oldInv.productId,
          name: oldInv.name,
          unit: "Pcs",
          date: inputDateStr || null,
          quantityChange: diff,
          balanceBefore: sameProductBalanceBefore,
          balanceAfter: nextInventoryQuantity,
        });
      }
    }

    const data = {
      name: targetInv.name,
      quantity: nextQty,
      variants: incomingVariants,
      purchase_price: toNumber(purchase_price),
      sale_price:
        customSalePrice !== null ? customSalePrice : toNumber(sale_price),
      supplierId,
      warehouseId,
      productId: targetInv.Id,
      note: finalStatus === "Approved" ? null : newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
    };

    const [updatedCount] = await ReturnProduct.update(data, {
      where: { Id: id },
      transaction: t,
    });

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
    });

    if (!users.length) return updatedCount;

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/purchase-product`,
        }),
      ),
    );

    return updatedCount;
  });
};
const getAllFromDBWithoutQuery = async () => {
  const result = await ReturnProduct.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const ReturnProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ReturnProductService;

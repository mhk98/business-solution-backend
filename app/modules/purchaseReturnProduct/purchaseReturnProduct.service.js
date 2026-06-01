const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  PurchaseReturnProductSearchableFields,
} = require("./purchaseReturnProduct.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const PurchaseReturnProduct = db.purchaseReturnProduct;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const Product = db.product;

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

const summarizeReturnItems = (items = []) => ({
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

const enrichVariantsWithInventoryPrices = (variants = [], inventory = {}) => {
  const sourceVariants = parseVariants(inventory.variants);

  return variants.map((variant) => {
    const sourceVariant = sourceVariants.find(
      (source) =>
        String(source?.size || "") === String(variant?.size || "") &&
        String(source?.color || "") === String(variant?.color || ""),
    );

    return {
      ...variant,
      purchase_price: Number(
        sourceVariant?.purchase_price ||
          inventory.purchase_price ||
          variant?.purchase_price ||
          0,
      ),
      sale_price: Number(
        sourceVariant?.sale_price ||
          inventory.sale_price ||
          variant?.sale_price ||
          0,
      ),
      sku: variant?.sku || sourceVariant?.sku || "",
    };
  });
};

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

const normalizeReturnItem = async (item, transaction) => {
  const returnQty = Number(item.quantity || 0);
  const receivedId = Number(item.receivedId || item.productId);
  const incomingVariants = parseVariants(item.variants);

  if (!receivedId) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const inventory = await findInventoryByRequestReference(receivedId, transaction);
  if (!inventory) throw new ApiError(404, "Product not found in inventory");

  const oldQty = Number(inventory.quantity || 0);
  if (oldQty < returnQty) {
    throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
  }

  const inventoryId = Number(inventory.Id);
  if (!inventoryId) {
    throw new ApiError(400, "InventoryMaster.Id missing");
  }

  const pricedIncomingVariants = enrichVariantsWithInventoryPrices(
    incomingVariants,
    inventory,
  );

  const finalVariants = pricedIncomingVariants.length
    ? subtractVariants(inventory.variants, pricedIncomingVariants)
    : inventory.variants;

  await inventory.update(
    {
      quantity: oldQty - returnQty,
      variants: finalVariants,
    },
    { transaction },
  );

  return {
    name: inventory.name,
    receivedId: inventoryId,
    productId: inventoryId,
    quantity: returnQty,
    variants: pricedIncomingVariants,
    purchase_price: Number(inventory.purchase_price || 0) * returnQty,
    sale_price: Number(inventory.sale_price || 0) * returnQty,
  };
};

const restoreReturnItemsToInventory = async (items = [], transaction) => {
  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    const inventory = await findInventoryByStoredReference(
      Number(item.productId || item.receivedId),
      transaction,
    );

    if (!inventory) throw new ApiError(404, "inventory product not found");

    await inventory.update(
      {
        quantity: Number(inventory.quantity || 0) + qty,
        variants: mergeVariants(inventory.variants, parseVariants(item.variants)),
      },
      { transaction },
    );
  }
};

const insertIntoDB = async (data) => {
  const bulkItems = getBulkItems(data);
  if (bulkItems.length > 1) {
    return insertBulkIntoDB(data, bulkItems);
  }

  const {
    quantity,
    receivedId,
    variants,
    date,
    status,
    note,
    userId,
    supplierId,
    warehouseId,
  } = data;

  console.log("purchaseReturn", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);
  const incomingVariants = parseVariants(variants);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return await db.sequelize.transaction(async (t) => {
    const inventory = await findInventoryByRequestReference(rid, t);

    if (!inventory) throw new ApiError(404, "Product not found in inventory");

    const oldQty = Number(inventory.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    const inventoryId = Number(inventory.Id);
    if (!inventoryId) {
      throw new ApiError(400, "InventoryMaster.Id missing");
    }

    const pricedIncomingVariants = enrichVariantsWithInventoryPrices(
      incomingVariants,
      inventory,
    );

    const result = await PurchaseReturnProduct.create(
      {
        name: inventory.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        variants: pricedIncomingVariants,
        source: "Purchase Return Product",
        purchase_price: inventory.purchase_price * returnQty,
        sale_price: inventory.sale_price * returnQty,
        productId: inventoryId,
        status: finalStatus || "---",
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
      },
      { transaction: t },
    );

    const finalQuantity = oldQty - returnQty;
    const finalVariants = pricedIncomingVariants.length
      ? subtractVariants(inventory.variants, pricedIncomingVariants)
      : inventory.variants;

    await inventory.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
        // purchase_price: inventory.purchase_price * finalQuantity,
        // sale_price: inventory.sale_price * finalQuantity,
      },
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
  const finalStatus = String(status || "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    const normalizedItems = [];

    for (const item of items) {
      normalizedItems.push(await normalizeReturnItem(item, t));
    }

    const results = [];
    for (const normalizedItem of normalizedItems) {
      const result = await PurchaseReturnProduct.create(
        {
          name: normalizedItem.name,
          supplierId,
          warehouseId,
          quantity: normalizedItem.quantity,
          variants: normalizedItem.variants,
          items: [],
          source: "Purchase Return Product",
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
      [Op.or]: PurchaseReturnProductSearchableFields.map((field) => ({
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

  const result = await PurchaseReturnProduct.findAll({
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

  // const total = await PurchaseReturnProduct.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    PurchaseReturnProduct.count({ where: whereConditions }),
    PurchaseReturnProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await PurchaseReturnProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await PurchaseReturnProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "productId", "quantity", "variants", "items"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const returnItems = parseItems(ret.items);
    if (returnItems.length > 0) {
      await restoreReturnItemsToInventory(returnItems, t);

      await PurchaseReturnProduct.destroy({
        where: { Id: id },
        transaction: t,
      });

      return { deleted: true };
    }

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) InventoryMaster খুঁজে বের করো (Products.Id দিয়ে)
    const inventory = await findInventoryByStoredReference(
      Number(ret.productId),
      t,
    );

    if (!inventory) throw new ApiError(404, "inventory product not found");

    const finalQuantity = Number(inventory.quantity || 0) + qty;
    const finalVariants = mergeVariants(inventory.variants, ret.variants);

    // 3) stock ফিরিয়ে দাও
    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
      },
      { where: { Id: inventory.Id }, transaction: t },
    );

    // 4) Return row delete
    await PurchaseReturnProduct.destroy({
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
//     const existing = await PurchaseReturnProduct.findOne({
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
//         ? "Purchase product return request approved"
//         : newNote || "Please approved my request";

//     // ✅ data (PurchaseReturnProduct)
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
//           stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
//         } else {
//           stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
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

//     const [updatedCount] = await PurchaseReturnProduct.update(data, {
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
  const {
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

  return db.sequelize.transaction(async (t) => {
    const existing = await PurchaseReturnProduct.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "note",
        "status",
        "quantity",
        "variants",
        "productId",
        "items",
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
    const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

    let finalStatus = existing.status || "Pending";
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

    await restoreReturnItemsToInventory(restoreItems, t);

    const nextItems = preparedItems.length ? preparedItems : oldItems;
    const normalizedItems = [];
    for (const item of nextItems) {
      normalizedItems.push(await normalizeReturnItem(item, t));
    }

    // Delete the old single bulk row and create separate rows per item
    await PurchaseReturnProduct.destroy({ where: { Id: id }, transaction: t });

    for (const normalizedItem of normalizedItems) {
      await PurchaseReturnProduct.create(
        {
          name: normalizedItem.name,
          supplierId,
          warehouseId,
          quantity: normalizedItem.quantity,
          variants: normalizedItem.variants,
          items: [],
          source: "Purchase Return Product",
          purchase_price: normalizedItem.purchase_price,
          sale_price: normalizedItem.sale_price,
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
      approvedMessage: "Purchase  product request approved",
      fallbackMessage: "Please approved my request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create(
          {
            userId: u.Id,
            message,
            url: `/${process.env.APP_BASE_URL}/purchase-product`,
          },
          { transaction: t },
        ),
      ),
    );

    return updatedCount;
  });
};

const updateOneFromDB = async (id, payload) => {
  const incomingBulkItems = getBulkItems(payload);
  if (incomingBulkItems.length > 1) {
    return updateBulkOneFromDB(id, payload, incomingBulkItems);
  }

  const existingItemsRow = await PurchaseReturnProduct.findOne({
    where: { Id: id },
    attributes: ["Id", "items"],
  });
  if (parseItems(existingItemsRow?.items).length > 0) {
    return updateBulkOneFromDB(id, payload, incomingBulkItems);
  }

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
  } = payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const incomingVariants = parseVariants(variants);
  const nextQty = Number(quantity || 0);

  return db.sequelize.transaction(async (t) => {
    // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
    const existing = await PurchaseReturnProduct.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "note",
        "status",
        "quantity",
        "variants",
        "productId",
        "items",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const qty = Number(existing.quantity || 0);
    const oldProductId = Number(existing.productId);
    const existingVariants = parseVariants(existing.variants);
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

    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
      approvedMessage: "Purchase  product request approved",
      fallbackMessage: "Please approved my request",
    });

    const oldInv = await InventoryMaster.findOne({
      where: { Id: oldProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldInv) throw new ApiError(404, "Old inventory product not found");

    await oldInv.update(
      {
        quantity: Number(oldInv.quantity || 0) + qty,
        variants: mergeVariants(oldInv.variants, existingVariants),
      },
      { transaction: t },
    );

    let targetInv = oldInv;
    if (Number(receivedId) !== oldProductId) {
      targetInv = await findInventoryByRequestReference(Number(receivedId), t);
    }

    if (!targetInv) throw new ApiError(404, "Product not found in inventory");

    const reducedQty = Number(targetInv.quantity || 0) - nextQty;
    if (reducedQty < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }

    const pricedIncomingVariants = enrichVariantsWithInventoryPrices(
      incomingVariants,
      targetInv,
    );

    const updatedVariants = pricedIncomingVariants.length
      ? subtractVariants(targetInv.variants, pricedIncomingVariants)
      : targetInv.variants;

    const data = {
      name: targetInv.name,
      quantity: nextQty,
      variants: pricedIncomingVariants,
      purchase_price: Number(targetInv.purchase_price || 0) * nextQty,
      sale_price: Number(targetInv.sale_price || 0) * nextQty,
      supplierId,
      warehouseId,
      productId: targetInv.Id,
      note: finalStatus === "Approved" ? null : newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
    };

    await targetInv.update(
      {
        quantity: reducedQty,
        variants: updatedVariants,
      },
      { transaction: t },
    );

    const [updatedCount] = await PurchaseReturnProduct.update(data, {
      where: {
        Id: id,
      },
      transaction: t,
    });

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId }, // sender বাদ
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
      },
    });

    console.log("users", users.length);
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
  const result = await PurchaseReturnProduct.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const PurchaseReturnProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PurchaseReturnProductService;

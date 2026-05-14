const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  DamageRepairedSearchableFields,
} = require("./damageRepaired.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const DamageRepaired = db.damageRepaired;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const DamageReparingStock = db.damageReparingStock;

const normalizeOptionalForeignKey = (value) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : null;
};

const findDamageReparingStockByReference = async (receivedId, transaction) => {
  const byId = await DamageReparingStock.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (byId) return byId;

  return DamageReparingStock.findOne({
    where: { productId: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
};

const getVariantKey = (variant) =>
  `${String(variant?.size || "").trim()}__${String(variant?.color || "").trim()}`;

const getVariantQuantityTotal = (variants) =>
  parseVariants(variants).reduce(
    (total, variant) => total + (Number(variant?.quantity) || 0),
    0,
  );

const assertValidVariantSelection = ({
  availableVariants,
  incomingVariants,
  quantity,
}) => {
  const availableRows = parseVariants(availableVariants);
  if (!availableRows.length) return;

  if (!incomingVariants.length) {
    throw new ApiError(400, "Please select variants for this repairing stock");
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
      throw new ApiError(
        400,
        "Selected variant is not available in repairing stock",
      );
    }

    if (quantity > availableQuantity) {
      throw new ApiError(
        400,
        "Variant quantity exceeds available repairing stock",
      );
    }
  });
};

const insertIntoDB = async (data) => {
  const {
    quantity,
    receivedId,
    productId,
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
  const normalizedSupplierId = normalizeOptionalForeignKey(supplierId);
  const normalizedWarehouseId = normalizeOptionalForeignKey(warehouseId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return await db.sequelize.transaction(async (t) => {
    const damageRepairingStock = await DamageReparingStock.findOne({
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    console.log("DamageRepairingStock", rid);

    if (!damageRepairingStock)
      throw new ApiError(404, "DamageRepairingStock product not found");

    const oldQty = Number(damageRepairingStock.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    assertValidVariantSelection({
      availableVariants: damageRepairingStock.variants,
      incomingVariants,
      quantity: returnQty,
    });

    const perUnitPurchase =
      oldQty > 0
        ? Number(damageRepairingStock.purchase_price || 0) / oldQty
        : 0;
    const perUnitSale =
      oldQty > 0 ? Number(damageRepairingStock.sale_price || 0) / oldQty : 0;

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    const damageRepairingStockId = Number(damageRepairingStock.Id);
    if (!damageRepairingStockId) {
      throw new ApiError(400, "DamageRepairingStock.Id missing");
    }

    const damageStockRepairingProductId = Number(
      damageRepairingStock.productId,
    );
    if (!damageStockRepairingProductId) {
      throw new ApiError(
        400,
        "DamageRepairingStock productId missing (DamageStock.Id)",
      );
    }

    const result = await DamageRepaired.create(
      {
        name: damageRepairingStock.name,
        supplierId: normalizedSupplierId,
        warehouseId: normalizedWarehouseId,
        source: "Damage Repaired",
        remarks: note,
        quantity: returnQty,
        variants: incomingVariants,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: damageRepairingStockId,
        status: finalStatus || "---",
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
      },
      { transaction: t },
    );

    const repairingQty = Number(damageRepairingStock.quantity || 0);
    if (repairingQty < returnQty) {
      throw new ApiError(
        400,
        `Not enough repairing stock. Available: ${repairingQty}`,
      );
    }

    await DamageReparingStock.update(
      {
        quantity: repairingQty - returnQty,
        purchase_price: Math.max(
          0,
          Number(damageRepairingStock.purchase_price || 0) - deductPurchase,
        ),
        sale_price: Math.max(
          0,
          Number(damageRepairingStock.sale_price || 0) - deductSale,
        ),
        variants: subtractVariants(
          damageRepairingStock.variants,
          incomingVariants,
        ),
      },
      { where: { Id: damageRepairingStock.Id }, transaction: t },
    );

    const inventory = await InventoryMaster.findOne({
      where: { productId: damageStockRepairingProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) throw new ApiError(404, "Inventory product not found");

    const receivedOldQty = Number(inventory.quantity || 0);

    // 3) Update InventoryMaster (plus repaired items)
    await InventoryMaster.update(
      {
        quantity: receivedOldQty + returnQty,
        variants: mergeVariants(inventory.variants, incomingVariants),
      },
      { where: { Id: inventory.Id }, transaction: t },
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
      [Op.or]: DamageRepairedSearchableFields.map((field) => ({
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

  const result = await DamageRepaired.findAll({
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

  // const total = await DamageRepaired.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    DamageRepaired.count({ where: whereConditions }),
    DamageRepaired.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await DamageRepaired.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await DamageRepaired.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "productId",
        "quantity",
        "purchase_price",
        "sale_price",
        "variants",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    const received = await DamageReparingStock.findOne({
      where: { Id: ret.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) {
      throw new ApiError(404, "DamageReparingStock product not found");
    }

    const catalogProductId = Number(received.productId);
    if (!catalogProductId) {
      throw new ApiError(
        400,
        "DamageReparingStock.productId missing (Products.Id)",
      );
    }

    await DamageReparingStock.update(
      {
        quantity: Number(received.quantity || 0) + qty,
        purchase_price:
          Number(received.purchase_price || 0) +
          Number(ret.purchase_price || 0),
        sale_price:
          Number(received.sale_price || 0) + Number(ret.sale_price || 0),
        variants: mergeVariants(received.variants, ret.variants),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    const inventory = await InventoryMaster.findOne({
      where: { productId: received.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) throw new ApiError(404, "Inventory product not found");

    const finalQuantity = Number(inventory.quantity || 0) - qty;
    if (finalQuantity < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }
    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        variants: subtractVariants(inventory.variants, ret.variants),
      },
      { where: { Id: inventory.Id }, transaction: t },
    );

    // 4) Return row delete
    await DamageRepaired.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const {
    quantity,
    receivedId, // এটা DamageReparingStock.Id (source)
    variants,
    note,
    date,
    status,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = data;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const incomingVariants = parseVariants(variants);

  const inputStatus = String(status || "").trim();
  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  const returnQty = Number(quantity);
  const rid = Number(receivedId);
  const normalizedSupplierId = normalizeOptionalForeignKey(supplierId);
  const normalizedWarehouseId = normalizeOptionalForeignKey(warehouseId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    // ✅ 0) যে রেকর্ডটা update হবে (DamageRepaired) সেটাই আগে lock করে আনো
    const existingRepaired = await DamageRepaired.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "quantity",
        "status",
        "note",
        "productId",
        "variants",
        "purchase_price",
        "sale_price",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existingRepaired) return 0;

    const oldRepairedQty = Number(existingRepaired.quantity || 0);
    const oldRepairedStatus = String(existingRepaired.status || "").trim();
    const oldProductId = Number(existingRepaired.productId);
    const existingVariants = parseVariants(existingRepaired.variants);

    const oldNote = String(existingRepaired.note || "").trim();
    const newNote = String(note || "").trim();

    const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
    const dateTriggersPending =
      Boolean(inputDateStr) && inputDateStr !== todayStr;

    // ✅ finalStatus (তোমার আগের লজিকের মতোই রাখা)
    let finalStatus = oldRepairedStatus || "Pending";
    if (isPrivileged) {
      finalStatus = inputStatus || finalStatus;
    } else {
      if (dateTriggersPending || noteTriggersPending) {
        finalStatus = "Pending";
      } else {
        finalStatus = inputStatus || finalStatus;
      }
    }

    const oldDamageReparingStock = await DamageReparingStock.findOne({
      where: { Id: oldProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldDamageReparingStock) {
      throw new ApiError(404, "Old DamageReparingStock not found");
    }

    const oldCatalogProductId = Number(oldDamageReparingStock.productId);
    if (!oldCatalogProductId) {
      throw new ApiError(
        400,
        "Old DamageReparingStock.productId missing (Products.Id)",
      );
    }

    await oldDamageReparingStock.update(
      {
        quantity: Number(oldDamageReparingStock.quantity || 0) + oldRepairedQty,
        purchase_price:
          Number(oldDamageReparingStock.purchase_price || 0) +
          Number(existingRepaired.purchase_price || 0),
        sale_price:
          Number(oldDamageReparingStock.sale_price || 0) +
          Number(existingRepaired.sale_price || 0),
        variants: mergeVariants(
          oldDamageReparingStock.variants,
          existingVariants,
        ),
      },
      { transaction: t },
    );

    const oldInventory = await InventoryMaster.findOne({
      where: { productId: oldCatalogProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldInventory) throw new ApiError(404, "Inventory not found");

    const rolledBackInventoryQty =
      Number(oldInventory.quantity || 0) - oldRepairedQty;
    if (rolledBackInventoryQty < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }

    await oldInventory.update(
      {
        quantity: rolledBackInventoryQty,
        variants: subtractVariants(oldInventory.variants, existingVariants),
      },
      { transaction: t },
    );

    const targetDamageReparingStock = await findDamageReparingStockByReference(
      rid,
      t,
    );

    if (!targetDamageReparingStock) {
      throw new ApiError(404, "DamageReparingStock product not found");
    }

    const damageReparingStockId = Number(targetDamageReparingStock.Id);
    if (!damageReparingStockId) {
      throw new ApiError(400, "DamageReparingStock.Id missing");
    }

    const targetCatalogProductId = Number(targetDamageReparingStock.productId);
    if (!targetCatalogProductId) {
      throw new ApiError(
        400,
        "DamageReparingStock.productId missing (Products.Id)",
      );
    }

    let targetInventory = oldInventory;
    if (damageReparingStockId !== oldProductId) {
      targetInventory = await InventoryMaster.findOne({
        where: { productId: targetCatalogProductId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    }

    if (!targetInventory) throw new ApiError(404, "Inventory not found");

    const availableDamageQty = Number(targetDamageReparingStock.quantity || 0);
    if (availableDamageQty < returnQty) {
      throw new ApiError(
        400,
        `Not enough repairing stock. Available: ${availableDamageQty}`,
      );
    }

    assertValidVariantSelection({
      availableVariants: targetDamageReparingStock.variants,
      incomingVariants,
      quantity: returnQty,
    });

    const perUnitPurchase =
      availableDamageQty > 0
        ? Number(targetDamageReparingStock.purchase_price || 0) /
          availableDamageQty
        : 0;
    const perUnitSale =
      availableDamageQty > 0
        ? Number(targetDamageReparingStock.sale_price || 0) / availableDamageQty
        : 0;

    const deductPurchaseNew = perUnitPurchase * returnQty;
    const deductSaleNew = perUnitSale * returnQty;

    const [updatedCount] = await DamageRepaired.update(
      {
        name: targetDamageReparingStock.name,
        supplierId: normalizedSupplierId,
        warehouseId: normalizedWarehouseId,
        remarks: note,
        quantity: returnQty,
        variants: incomingVariants,
        purchase_price: deductPurchaseNew,
        sale_price: deductSaleNew,
        note: finalStatus === "Approved" ? null : newNote || null,
        status: finalStatus,
        date: inputDateStr || undefined,
        productId: damageReparingStockId,
      },
      { where: { Id: id }, transaction: t },
    );

    const newDamageQty = availableDamageQty - returnQty;
    if (newDamageQty < 0) {
      throw new ApiError(400, "DamageReparingStock cannot be negative");
    }

    await targetDamageReparingStock.update(
      {
        quantity: newDamageQty,
        purchase_price: Math.max(
          0,
          Number(targetDamageReparingStock.purchase_price || 0) -
            deductPurchaseNew,
        ),
        sale_price: Math.max(
          0,
          Number(targetDamageReparingStock.sale_price || 0) - deductSaleNew,
        ),
        variants: subtractVariants(
          targetDamageReparingStock.variants,
          incomingVariants,
        ),
      },
      { transaction: t },
    );

    await targetInventory.update(
      {
        quantity: Number(targetInventory.quantity || 0) + returnQty,
        variants: mergeVariants(targetInventory.variants, incomingVariants),
      },
      { transaction: t },
    );

    // ✅ 5) Notification
    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (users.length) {
      const msg = resolveApprovalNotificationMessage({
        status: finalStatus,
        note: newNote,
        date: inputDateStr,
        approvedMessage: "Damage product request approved",
        fallbackMessage: "Damage product updated",
      });

      await Promise.all(
        users.map((u) =>
          Notification.create(
            {
              userId: u.Id,
              message: msg,
              url: `/${process.env.APP_BASE_URL}/damage-product`,
            },
            { transaction: t },
          ),
        ),
      );
    }

    return updatedCount;
  });
};

// const updateOneFromDB = async (id, data) => {
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
//   } = data;

//   console.log("Damage", data);

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
//   const existing = await DamageRepaired.findOne({
//     where: { Id: id },
//     attributes: ["Id", "note", "status"],
//   });

//   if (!existing) return 0;

//   const oldNote = String(existing.note || "").trim();
//   const newNote = String(note || "").trim();

//   // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
//   const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

//   // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
//   const dateTriggersPending =
//     Boolean(inputDateStr) && inputDateStr !== todayStr;

//   const inputStatus = String(status || "").trim();

//   let finalStatus = existing.status || "Pending";

//   const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

//   if (isPrivileged) {
//     // ✅ superAdmin/admin: যা পাঠাবে সেটাই
//     finalStatus = inputStatus || finalStatus;
//   } else {
//     // ✅ others: today date না হলে বা new note হলে Pending override
//     if (dateTriggersPending || noteTriggersPending) {
//       finalStatus = "Pending";
//     } else {
//       // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
//       finalStatus = inputStatus || finalStatus;
//     }
//   }

//   const returnQty = Number(quantity);
//   const rid = Number(receivedId);

//   if (!rid) throw new ApiError(400, "receivedId is required");
//   if (!returnQty || returnQty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   return await db.sequelize.transaction(async (t) => {
//     const received = await DamageStock.findOne({
//       where: { Id: rid },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!received) throw new ApiError(404, "Received product not found");

//     const oldQty = Number(received.quantity || 0);

//     // if (oldQty < returnQty) {
//     //   throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
//     // }

//     const perUnitPurchase =
//       oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
//     const perUnitSale =
//       oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;

//     const deductPurchase = perUnitPurchase * returnQty;
//     const deductSale = perUnitSale * returnQty;

//     const realProductId = Number(received.productId);
//     if (!realProductId) {
//       throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
//     }

//     const existing = await DamageRepaired.findOne({
//       where: { Id: id },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     const data = {
//       name: received.name,
//       supplierId,
//       warehouseId,
//       remarks: received.remarks,
//       quantity: returnQty,
//       purchase_price: received.purchase_price * returnQty,
//       sale_price: received.sale_price * returnQty,
//       note: finalStatus === "Approved" ? null : newNote || null,
//       status: finalStatus,
//       date: inputDateStr || undefined,
//       productId: realProductId, // ✅ Products.Id (FK)
//     };

//     const [updatedCount] = await DamageRepaired.update(data, {
//       where: { Id: id },
//       transaction: t,
//     });

//     let receivedFinalQty = 0;
//     if (Number(existing.quantity) > Number(quantity)) {
//       receivedFinalQty = Number(existing.quantity) - Number(quantity);
//     } else {
//       receivedFinalQty = Number(quantity) - Number(existing.quantity);
//     }

//     if (existing) {
//       let stockQuantity = 0;
//       if (Number(existing.quantity) > Number(quantity)) {
//         stockQuantity = Number(existing.quantity) + Number(receivedFinalQty);
//       } else {
//         stockQuantity = Number(existing.quantity) - Number(receivedFinalQty);
//       }

//       // চাইলে negative prevent করতে পারেন
//       if (stockQuantity < 0)
//         throw new ApiError(
//           400,
//           "Damage stock not enough product for this update",
//         );

//       // const oldQty = Number(inv.quantity);
//       // const perUnitPurchase =
//       //   oldQty > 0 ? Number(inv.purchase_price || 0) / oldQty : 0;
//       // const perUnitSale = oldQty > 0 ? Number(inv.sale_price || 0) / oldQty : 0;

//       await DamageStock.update(
//         {
//           quantity: stockQuantity,
//         },
//         { where: { Id: received.Id }, transaction: t },
//       );
//     }

//      const existingMasterInventory = await InventoryMaster.findOne({
//       where: { productId: existing.productId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//      let masterFinalQty = 0;
//     if (Number(existing.quantity) > Number(quantity)) {
//       masterFinalQty = Number(existing.quantity) - Number(quantity);
//     } else {
//       masterFinalQty = Number(quantity) - Number(existing.quantity);
//     }

//     if (existing) {
//       let stockQuantity = 0;
//       if (Number(existingMasterInventory.quantity) > Number(masterFinalQty)) {
//         stockQuantity = Number(existingMasterInventory.quantity) + Number(masterFinalQty);
//       } else {
//         stockQuantity = Number(existingMasterInventory.quantity) - Number(masterFinalQty);
//       }

//     await InventoryMaster.update(
//       {
//         quantity: stockQuantity,
//         purchase_price: Number(existingMasterInventory.purchase_price * stockQuantity || 0),

//         sale_price:
//           Number(existingMasterInventory.sale_price * stockQuantity || 0),
//       },
//       { where: { Id: existingMasterInventory.Id }, transaction: t },
//     );

//     const users = await User.findAll({
//       attributes: ["Id", "role"],
//       where: {
//         Id: { [Op.ne]: userId }, // sender বাদ
//         role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
//       },
//     });

//     console.log("users", users.length);
//     if (!users.length) return updatedCount;

//     const message =
//       finalStatus === "Approved"
//         ? "Damage product request approved"
//         : note || "Damage product updated";

//     await Promise.all(
//       users.map((u) =>
//         Notification.create({
//           userId: u.Id,
//           message,
//           url: `/${process.env.APP_BASE_URL}/damage-product`,
//         }),
//       ),
//     );
//     return updatedCount;
//   });
// };

const getAllFromDBWithoutQuery = async () => {
  const result = await DamageRepaired.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const DamageRepairedService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DamageRepairedService;

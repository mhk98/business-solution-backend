const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DamageProductSearchableFields } = require("./damageProduct.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const DamageProduct = db.damageProduct;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const DamageStock = db.damageStock;

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

const findInventoryByRequestReference = async (rid, transaction) => {
  const inventoryByProductId = await InventoryMaster.findOne({
    where: { Id: rid },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (inventoryByProductId) return inventoryByProductId;

  return findInventoryByStoredReference(receivedId, transaction);
};

const findDamageStockByProductId = async (productId, transaction) =>
  DamageStock.findOne({
    where: { productId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

// const insertIntoDB = async (data) => {
//   const { quantity, productId } = data;

//   const qty = Number(quantity);

//   if (!qty || qty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   return await db.sequelize.transaction(async (t) => {
//     // ✅ InventoryMaster (stock)
//     // ⚠️ যদি তোমার InventoryMaster এ productId নামে কলাম থাকে, তাহলে where: { productId } করবে
//     const received = await InventoryMaster.findOne({
//       where: { Id: productId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!received) throw new ApiError(404, "Received product not found");

//     // ✅ Stock check
//     const availableQty = Number(received.quantity);
//     if (availableQty < qty) {
//       throw new ApiError(400, `Not enough stock. Available: ${availableQty}`);
//     }

//     // ✅ Return amounts (per unit * qty)
//     const unitPurchase = Number(productData.purchase_price);
//     const unitSale = Number(productData.sale_price);

//     const returnPurchase = unitPurchase * qty;
//     const returnSale = unitSale * qty;

//     // ✅ Create Purchase Return row (store returned totals)
//     const payload = {
//       name: productData.name,
//       supplier: productData.supplier,
//       quantity: qty,
//       purchase_price: returnPurchase,
//       sale_price: returnSale,
//       productId,
//     };

//     const result = await DamageProduct.create(payload, {
//       transaction: t,
//     });

//     // ✅ Update InventoryMaster (subtract qty & totals)
//     const newQty = availableQty - qty;

//     const newPurchaseTotal = Math.max(
//       0,
//       Number(received.purchase_price) - returnPurchase,
//     );

//     const newSaleTotal = Math.max(0, Number(received.sale_price) - returnSale);

//     await InventoryMaster.update(
//       {
//         quantity: newQty,
//         purchase_price: newPurchaseTotal,
//         sale_price: newSaleTotal,
//       },
//       {
//         where: { Id: received.Id }, // যদি where: { productId } লাগে, এখানে বদলাবে
//         transaction: t,
//       },
//     );

//     return result;
//   });
// };

const insertIntoDB = async (data) => {
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
    const inventory = await findInventoryByRequestReference(rid, t);

    if (!inventory) throw new ApiError(404, "inventory product not found");

    const oldQty = Number(inventory.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    console.log("inventory", inventory);
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

    const catalogProductId = Number(inventory.productId);
    if (!catalogProductId) {
      throw new ApiError(
        400,
        "InventoryMaster.productId missing (Products.Id)",
      );
    }

    const result = await DamageProduct.create(
      {
        name: inventory.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        variants: incomingVariants,
        source: "Damage Product",
        purchase_price: inventory.purchase_price * returnQty,
        sale_price: inventory.sale_price * returnQty,
        productId: inventoryId,
        status: finalStatus || "---",
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
      },
      { transaction: t },
    );

    if (result) {
      const dStock = await findDamageStockByProductId(catalogProductId, t);

      if (dStock) {
        await dStock.update(
          {
            quantity: Number(dStock.quantity || 0) + Number(quantity || 0),
            variants: mergeVariants(dStock.variants, incomingVariants),
            purchase_price:
              Number(dStock.purchase_price || 0) +
              Number(inventory.purchase_price || 0) * Number(quantity || 0),
            sale_price:
              Number(dStock.sale_price || 0) +
              Number(inventory.sale_price || 0) * Number(quantity || 0),
          },
          { transaction: t },
        );
      } else {
        await DamageStock.create(
          {
            productId: catalogProductId,
            name: inventory.name,
            quantity: Number(quantity || 0),
            variants: incomingVariants,
            purchase_price:
              Number(inventory.purchase_price || 0) * Number(quantity || 0),
            sale_price:
              Number(inventory.sale_price || 0) * Number(quantity || 0),
          },
          { transaction: t },
        );
      }
    }
    const finalQuantity = oldQty - returnQty;
    const finalVariants = incomingVariants.length
      ? subtractVariants(inventory.variants, incomingVariants)
      : inventory.variants;
    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
        purchase_price: Number(inventory.purchase_price),
        sale_price: Number(inventory.sale_price),
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
        approvedMessage: "Inventory product request approved",
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
    console.log("damageproduct", inventory.name, "-----result", result);

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
      [Op.or]: DamageProductSearchableFields.map((field) => ({
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

  const result = await DamageProduct.findAll({
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

  // const total = await DamageProduct.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    DamageProduct.count({ where: whereConditions }),
    DamageProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await DamageProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await DamageProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "productId", "quantity", "variants"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    // if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) InventoryMaster খুঁজে বের করো (Products.Id দিয়ে)
    const inventoryMaster = await findInventoryByStoredReference(
      Number(ret.productId),
      t,
    );

    if (!inventoryMaster)
      throw new ApiError(404, "Inventory product not found");

    const finalQuantity = Number(inventoryMaster.quantity || 0) + qty;
    const finalVariants = mergeVariants(inventoryMaster.variants, ret.variants);
    const damageStock = await findDamageStockByProductId(
      Number(inventoryMaster.productId),
      t,
    );

    if (damageStock) {
      const nextDamageQty = Number(damageStock.quantity || 0) - qty;
      if (nextDamageQty < 0) {
        throw new ApiError(400, "DamageStock cannot be negative");
      }

      await damageStock.update(
        {
          quantity: nextDamageQty,
          variants: subtractVariants(damageStock.variants, ret.variants),
          purchase_price: Math.max(
            0,
            Number(damageStock.purchase_price || 0) -
              Number(ret.purchase_price || 0),
          ),
          sale_price: Math.max(
            0,
            Number(damageStock.sale_price || 0) - Number(ret.sale_price || 0),
          ),
        },
        { transaction: t },
      );
    }

    // 3) stock ফিরিয়ে দাও
    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
        // purchase_price: Number(received.purchase_price * finalQuantity),
        // sale_price: Number(received.sale_price * finalQuantity),
      },
      { where: { Id: inventoryMaster.Id }, transaction: t },
    );

    // 4) Return row delete
    await DamageProduct.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

// const updateOneFromDB = async (id, data) => {
//   const {
//     quantity,
//     receivedId,
//     note,
//     date,
//     status,
//     userId,
//     supplierId,
//     warehouseId,
//     actorRole,
//   } = data;

//   console.log("Damage", data);

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
//   const existing = await DamageProduct.findOne({
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
//     const received = await InventoryMaster.findOne({
//       where: { productId: rid },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!received) throw new ApiError(404, "Received product not found");

//     const oldQty = Number(received.quantity || 0);
//     if (oldQty < returnQty) {
//       throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
//     }

//     const perUnitPurchase =
//       oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
//     const perUnitSale =
//       oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;

//     const deductPurchase = perUnitPurchase * returnQty;
//     const deductSale = perUnitSale * returnQty;

//     const realProductId = Number(received.productId);
//     if (!realProductId) {
//       throw new ApiError(
//         400,
//         "InventoryMaster.productId missing (Products.Id)",
//       );
//     }

//     const [updatedCount] = await DamageProduct.update(
//       {
//         name: received.name,
//         supplierId,
//         warehouseId,
//         quantity: returnQty,
//         purchase_price: deductPurchase,
//         sale_price: deductSale,
//         note: finalStatus === "Approved" ? null : newNote || null,
//         status: finalStatus,
//         date: inputDateStr || undefined,
//       },
//       {
//         where: { Id: id },
//         transaction: t,
//       },
//     );

//     if (status === "Approved") {
//       await InventoryMaster.update(
//         {
//           quantity: oldQty - returnQty,
//           purchase_price: Math.max(
//             0,
//             Number(received.purchase_price || 0) - deductPurchase,
//           ),
//           sale_price: Math.max(
//             0,
//             Number(received.sale_price || 0) - deductSale,
//           ),
//         },
//         { where: { Id: received.Id }, transaction: t },
//       );
//     }

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

const updateOneFromDB = async (id, payload) => {
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
    const existing = await DamageProduct.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "note",
        "status",
        "quantity",
        "variants",
        "productId",
        "purchase_price",
        "sale_price",
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

    const updatedVariants = incomingVariants.length
      ? subtractVariants(targetInv.variants, incomingVariants)
      : targetInv.variants;

    const data = {
      name: targetInv.name,
      quantity: nextQty,
      variants: incomingVariants,
      purchase_price: Number(targetInv.purchase_price || 0) * nextQty,
      sale_price: Number(targetInv.sale_price || 0) * nextQty,
      supplierId,
      warehouseId,
      productId: targetInv.Id,
      note: finalStatus === "Approved" ? null : newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
    };

    const oldCatalogProductId = Number(oldInv.productId);
    if (!oldCatalogProductId) {
      throw new ApiError(400, "Old inventory productId missing");
    }

    const oldDamageStock = await findDamageStockByProductId(
      oldCatalogProductId,
      t,
    );
    if (oldDamageStock) {
      const rolledBackDamageQty = Number(oldDamageStock.quantity || 0) - qty;
      if (rolledBackDamageQty < 0) {
        throw new ApiError(400, "DamageStock cannot be negative");
      }

      await oldDamageStock.update(
        {
          quantity: rolledBackDamageQty,
          variants: subtractVariants(oldDamageStock.variants, existingVariants),
          purchase_price: Math.max(
            0,
            Number(oldDamageStock.purchase_price || 0) -
              Number(existing.purchase_price || 0),
          ),
          sale_price: Math.max(
            0,
            Number(oldDamageStock.sale_price || 0) -
              Number(existing.sale_price || 0),
          ),
        },
        { transaction: t },
      );
    }

    const targetCatalogProductId = Number(targetInv.productId);
    let targetDamageStock = oldDamageStock;
    if (targetCatalogProductId !== oldCatalogProductId) {
      targetDamageStock = await findDamageStockByProductId(
        targetCatalogProductId,
        t,
      );
    }

    if (targetDamageStock) {
      await targetDamageStock.update(
        {
          quantity: Number(targetDamageStock.quantity || 0) + nextQty,
          variants: mergeVariants(targetDamageStock.variants, incomingVariants),
          purchase_price:
            Number(targetDamageStock.purchase_price || 0) +
            Number(data.purchase_price || 0),
          sale_price:
            Number(targetDamageStock.sale_price || 0) +
            Number(data.sale_price || 0),
        },
        { transaction: t },
      );
    } else {
      await DamageStock.create(
        {
          productId: targetCatalogProductId,
          name: targetInv.name,
          quantity: nextQty,
          variants: incomingVariants,
          purchase_price: Number(data.purchase_price || 0),
          sale_price: Number(data.sale_price || 0),
        },
        { transaction: t },
      );
    }

    await targetInv.update(
      {
        quantity: reducedQty,
        variants: updatedVariants,
      },
      { transaction: t },
    );

    const [updatedCount] = await DamageProduct.update(data, {
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
  const result = await DamageProduct.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const DamageProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DamageProductService;

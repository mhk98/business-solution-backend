const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { PosReportSearchableFields } = require("./posReport.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const PosReport = db.posReport;
const Notification = db.notification;
const User = db.user;
const WarrantyProduct = db.warrantyProduct;
const InventoryMaster = db.inventoryMaster;
const ConfirmOrder = db.confirmOrder;

const normalizeItems = (items) => {
  if (Array.isArray(items)) return items;

  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const buildItemQuantityMap = (items = []) => {
  return normalizeItems(items).reduce((acc, item) => {
    const referenceId = Number(item?.Id);
    const qty = Number(item?.qty) || 0;

    if (!referenceId || qty <= 0) return acc;

    acc[referenceId] = (acc[referenceId] || 0) + qty;
    return acc;
  }, {});
};

const applyInventoryDeltaMap = async (deltaMap, transaction) => {
  for (const [referenceIdString, diff] of Object.entries(deltaMap)) {
    const referenceId = Number(referenceIdString);
    const quantityDiff = Number(diff) || 0;

    if (!referenceId || quantityDiff === 0) continue;

    const inventory = await findInventoryByReference(referenceId, transaction);

    if (!inventory) {
      throw new ApiError(404, `inventory product not found: ${referenceId}`);
    }

    const currentQuantity = Number(inventory.quantity || 0);
    const nextQuantity = currentQuantity - quantityDiff;

    if (nextQuantity < 0) {
      throw new ApiError(
        400,
        `Not enough stock for inventory_id=${referenceId}. Available: ${currentQuantity}`,
      );
    }

    await InventoryMaster.update(
      { quantity: nextQuantity },
      {
        where: { Id: inventory.Id },
        transaction,
      },
    );
  }
};

const removeConfirmOrdersForPosReportItems = async (
  items,
  saleDate,
  transaction,
  createdAt,
) => {
  const normalizedItems = normalizeItems(items);

  for (const item of normalizedItems) {
    const productId = Number(item?.Id) || 0;
    const qty = Number(item?.qty) || 0;
    const totalPrice = Number(item?.total ?? (Number(item?.price) || 0) * qty);
    const itemName = String(item?.name || "").trim();

    if (!productId || qty <= 0) continue;

    const whereConditions = {
      productId,
      quantity: qty,
      sale_price: totalPrice,
      date: saleDate,
    };

    if (itemName) {
      whereConditions.name = itemName;
    }

    if (createdAt) {
      const from = new Date(new Date(createdAt).getTime() - 5 * 60 * 1000);
      const to = new Date(new Date(createdAt).getTime() + 5 * 60 * 1000);
      whereConditions.createdAt = { [Op.between]: [from, to] };
    }

    const row = await ConfirmOrder.findOne({
      where: whereConditions,
      order: [["createdAt", "DESC"]],
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });

    if (!row) continue;

    await ConfirmOrder.destroy({
      where: { Id: row.Id },
      transaction,
    });
  }
};

const findInventoryByReference = async (referenceId, transaction) => {
  const inventoryByInventoryId = await InventoryMaster.findOne({
    where: { Id: referenceId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (inventoryByInventoryId) return inventoryByInventoryId;

  return InventoryMaster.findOne({
    where: { Id: referenceId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
};

const insertIntoDB = async (payload) => {
  const {
    name,
    date,
    note,
    mobile,
    address,
    subTotal,
    discount,
    deliveryCharge,
    total,
    paidAmount,
    warrantyValue,
    warrantyUnit,
    status,
    items,
  } = payload || {};

  if (!name) throw new ApiError(400, "Customer name is required");
  if (!date) throw new ApiError(400, "Sell date is required");
  if (!Array.isArray(items) || items.length === 0)
    throw new ApiError(400, "Items are required");

  const finalPaid = Number(paidAmount) || 0;
  const finalTotal = Number(total) || 0;
  const finalDue = Math.max(0, finalTotal - finalPaid);

  // const finalStatus =
  //   String(status || "").trim() || (finalDue > 0 ? "DUE" : "PAID");

  // const todayStr = new Date().toISOString().slice(0, 10);
  // const inputDateStr = String(date || "").slice(0, 10);

  // const isApproved = String(status || "").trim() === "Approved";

  // const warrantyProductStatus = isApproved
  //   ? "Approved"
  //   : inputDateStr !== todayStr
  //     ? "Pending"
  //     : null;

  const finalStatus = String(status || "").trim() || "Active";

  return await db.sequelize.transaction(async (t) => {
    await applyInventoryDeltaMap(buildItemQuantityMap(items), t);

    // ✅ 2) PosReport create
    const result = await PosReport.create(
      {
        name,
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
        mobile: mobile || null,
        address: address || null,
        subTotal: Number(subTotal) || 0,
        discount: Number(discount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        total: finalTotal,
        paidAmount: finalPaid,
        dueAmount: finalDue,
        status: finalStatus || "---",
        amount: finalPaid,
        items,
      },
      { transaction: t },
    );

    if (items.length > 0) {
      const cart = [];
      for (const it of items) {
        const productId = Number(it.Id) || 0;
        const qty = Number(it.qty) || 0;
        const unitPrice = Number(it.price) || 0;
        const itemName = (it.name && String(it.name).trim()) || "N/A"; // fallback

        if (qty <= 0) continue;

        cart.push({
          name: itemName,
          quantity: qty,
          sale_price: unitPrice * qty, // ✅ total price
          date: date,
          productId: productId,
        });
      }

      if (cart.length) {
        await ConfirmOrder.bulkCreate(cart, { transaction: t });
      }
    }
    // ✅ 3) WarrantyProduct insert from items
    // warranty না থাকলে skip করতে চাইলে এই guard টা রাখো
    if (Number(warrantyValue) > 0 && warrantyUnit) {
      const warrantyRows = [];

      for (const it of items) {
        const qty = Number(it.qty) || 0;
        const unitPrice = Number(it.price) || 0;
        const itemName = (it.name && String(it.name).trim()) || "N/A"; // fallback

        if (qty <= 0) continue;

        warrantyRows.push({
          name: itemName,
          quantity: qty,
          price: unitPrice * qty, // ✅ total price
          date: date,
          warrantyValue: Number(warrantyValue) || 0,
          warrantyUnit: warrantyUnit || null,
        });
      }

      if (warrantyRows.length) {
        await WarrantyProduct.bulkCreate(warrantyRows, { transaction: t });
      }
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
      [Op.or]: PosReportSearchableFields.map((field) => ({
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

  const result = await PosReport.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await PosReport.count({ where: whereConditions });

  // // ✅ total count + total quantity (same filters)
  // const [count, totalQuantity] = await Promise.all([
  //   PosReport.count({ where: whereConditions }),
  //   PosReport.sum("quantity", { where: whereConditions }),
  // ]);

  return {
    meta: { page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await PosReport.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    const ret = await PosReport.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "POS report not found");

    const existingItems = normalizeItems(ret.items);
    const restoreMap = Object.entries(
      buildItemQuantityMap(existingItems),
    ).reduce((acc, [referenceId, qty]) => {
      acc[referenceId] = -Number(qty || 0);
      return acc;
    }, {});

    await applyInventoryDeltaMap(restoreMap, t);
    await removeConfirmOrdersForPosReportItems(
      existingItems,
      ret.date,
      t,
      ret.createdAt,
    );

    await PosReport.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

// const updateOneFromDB = async (id, data) => {
//   const { quantity, receivedId, note, status, userId } = data;

//   console.log("InTransit", data);

//   const returnQty = Number(quantity);
//   const rid = Number(receivedId);

//   if (!rid) throw new ApiError(400, "receivedId is required");
//   if (!returnQty || returnQty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   return await db.sequelize.transaction(async (t) => {
//     const received = await ReceivedProduct.findOne({
//       where: { Id: rid },
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
//         "ReceivedProduct.productId missing (Products.Id)",
//       );
//     }

//     const [updatedCount] = await PosReport.update(
//       {
//         name: received.name,
//         supplier: received.supplier,
//         quantity: returnQty,
//         purchase_price: deductPurchase,
//         note: status === "Approved" ? null : note,
//         status: status ? status : "Pending",
//         sale_price: deductSale,
//         productId: realProductId, // ✅ Products.Id (FK)
//       },
//       {
//         where: { Id: id },
//         transaction: t,
//       },
//     );

//     if (status === "Approved") {
//       await ReceivedProduct.update(
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
//         ? "Intransit product request approved"
//         : finalNote || "Intransit product updated";

//     await Promise.all(
//       users.map((u) =>
//         Notification.create({
//           userId: u.Id,
//           message,
//           url: `/${process.env.APP_BASE_URL}/intransit-product`,
//         }),
//       ),
//     );
//     return updatedCount;
//   });
// };

const updateOneFromDB = async (id, data) => {
  const {
    name,
    date,
    note,
    status,
    mobile,
    address,
    deliveryCharge,
    discount,
    dueAmount,
    items,
    paidAmount,
    subTotal,
    total,
    userId,
    actorRole,
  } = data;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const result = await db.sequelize.transaction(async (t) => {
    const existing = await PosReport.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) throw new ApiError(404, "POS report not found");

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

    const existingItemsMap = buildItemQuantityMap(existing.items);
    const nextItemsMap = buildItemQuantityMap(items);
    const allReferenceIds = new Set([
      ...Object.keys(existingItemsMap),
      ...Object.keys(nextItemsMap),
    ]);

    const deltaMap = {};
    for (const referenceId of allReferenceIds) {
      const nextQty = Number(nextItemsMap[referenceId] || 0);
      const oldQty = Number(existingItemsMap[referenceId] || 0);
      const diff = nextQty - oldQty;
      if (diff !== 0) deltaMap[referenceId] = diff;
    }

    await applyInventoryDeltaMap(deltaMap, t);

    return PosReport.update(
      {
        name,
        note: finalStatus === "Approved" ? null : newNote || null,
        status: finalStatus,
        date: inputDateStr || undefined,
        mobile,
        address,
        deliveryCharge,
        discount,
        dueAmount,
        items,
        paidAmount,
        subTotal,
        total,
      },
      {
        where: { Id: id },
        transaction: t,
      },
    );
  });

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
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PosReport.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const PosReportService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PosReportService;

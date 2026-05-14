const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { AssetsSaleSearchableFields } = require("./assetsSale.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const AssetsSale = db.assetsSale;
const AssetsStock = db.assetsStock;
const Notification = db.notification;
const User = db.user;
const {
  rebuildAssetsStockBalances,
  STOCK_STATUSES,
} = require("../assetsStock/assetsStockSync");

const insertIntoDB = async (data) => {
  const { productId, quantity, price, date, note, status } = data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return await db.sequelize.transaction(async (t) => {
    const stock = await AssetsStock.findOne({
      where: { Id: productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stock) throw new ApiError(404, "Assets stock product not found");

    if (
      STOCK_STATUSES.includes(finalStatus) &&
      Number(stock.quantity || 0) < Number(quantity)
    ) {
      throw new ApiError(400, `Not enough stock. Available: ${stock.quantity}`);
    }
    const saleQty = Number(quantity);

    const payload = {
      name: stock.name,
      quantity: saleQty,
      price,
      total: price * quantity,
      productId,
      status: finalStatus || "---",
      note: finalStatus === "Approved" ? null : note || null,
      date: date,
    };

    const result = await AssetsSale.create(payload, {
      transaction: t,
    });

    await rebuildAssetsStockBalances(t);

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
      [Op.or]: AssetsSaleSearchableFields.map((field) => ({
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

  const result = await AssetsSale.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await AssetsSale.count({ where: whereConditions });

  const [count, totalQuantity] = await Promise.all([
    AssetsSale.count({ where: whereConditions }),
    AssetsSale.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await AssetsSale.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Sale row বের করো
    const sale = await AssetsSale.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) throw new ApiError(404, "AssetsSale not found");

    const saleQty = Number(sale.quantity || 0);
    if (saleQty <= 0) throw new ApiError(400, "Invalid sale quantity");

    await AssetsSale.destroy({
      where: { Id: id },
      transaction: t,
    });

    await rebuildAssetsStockBalances(t);

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const { productId, quantity, price, note, status, date, userId, actorRole } =
    data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const q = quantity === "" || quantity == null ? undefined : Number(quantity);
  const p = price === "" || price == null ? undefined : Number(price);

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await AssetsSale.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status", "productId", "quantity"],
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

  return await db.sequelize.transaction(async (t) => {
    const selectedProductId =
      productId === "" || productId == null
        ? existing.productId
        : Number(productId);

    const stock = await AssetsStock.findOne({
      where: { Id: selectedProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stock) throw new ApiError(404, "Assets stock product not found");

    const reservedExisting =
      STOCK_STATUSES.includes(String(existing.status || "").trim()) &&
      Number(existing.productId) === Number(selectedProductId)
        ? Number(existing.quantity || 0)
        : 0;

    if (
      STOCK_STATUSES.includes(finalStatus) &&
      Number(stock.quantity || 0) + reservedExisting < Number(quantity)
    ) {
      throw new ApiError(
        400,
        `Not enough stock. Available: ${Number(stock.quantity || 0) + reservedExisting}`,
      );
    }

    const saleQty = Number(quantity);

    const payload = {
      name: stock.name,
      quantity: saleQty,
      price,
      note: finalStatus === "Approved" ? null : newNote || null,
      status: finalStatus,
      total: Number.isFinite(p) && Number.isFinite(q) ? p * q : undefined,
      date: inputDateStr || undefined,
      productId: selectedProductId,
    };

    const [updatedCount] = await AssetsSale.update(payload, {
      where: { Id: id },

      transaction: t,
    });

    await rebuildAssetsStockBalances(t);

    // ✅ শুধু admin/superAdmin/inventory রোলের ইউজার
    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId }, // sender বাদ
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
      },
      transaction: t,
    });

    console.log("users", users.length);
    if (!users.length) return updatedCount;

    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
      approvedMessage: "Assets sale request approved",
      fallbackMessage: "Assets sale updated",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create(
          {
            userId: u.Id,
            message,
            url: `/${process.env.APP_BASE_URL}/assets-sale`,
          },
          {
            transaction: t,
          },
        ),
      ),
    );

    return updatedCount;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await AssetsSale.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const AssetsSaleService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = AssetsSaleService;

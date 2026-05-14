const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  AssetsRequisitionSearchableFields,
} = require("./assetsRequisition.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const AssetsRequisition = db.assetsRequisition;
const Asset = db.asset;
const Notification = db.notification;
const User = db.user;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || ["undefined", "null"].includes(text.toLowerCase())) return null;
  return text;
};

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

const resolveAsset = async (
  payload = {},
  existing = null,
  transaction = null,
) => {
  const assetId = normalizeOptionalId(payload.assetId);
  const assetName = normalizeOptionalText(
    payload.assetName || payload.newAssetName || payload.name,
  );

  if (assetId) {
    const asset = await Asset.findOne({ where: { Id: assetId }, transaction });
    if (!asset) throw new ApiError(404, "Asset not found");
    return { name: asset.name, assetId: asset.Id };
  }

  if (assetName) {
    const [asset] = await Asset.findOrCreate({
      where: { name: assetName },
      defaults: { name: assetName },
      transaction,
    });
    return { name: asset.name, assetId: asset.Id };
  }

  if (existing) {
    return { name: existing.name, assetId: existing.assetId || null };
  }

  throw new ApiError(400, "Asset is required");
};

const insertIntoDB = async (payload) => {
  const { quantity, price, date, note, status, userId } = payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  const finalStatus = "Pending";

  const result = await db.sequelize.transaction(async (transaction) => {
    const asset = await resolveAsset(payload, null, transaction);
    const data = {
      name: asset.name,
      assetId: asset.assetId,
      quantity,
      price,
      date,
      total: Number(price * quantity),
      status: finalStatus || "---",
      note: finalStatus === "Approved" ? null : note || null,
    };

    return AssetsRequisition.create(data, { transaction });
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin"] },
    },
  });

  if (users.length) {
    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note,
      date: inputDateStr,
      approvedMessage: "Assets requisition request approved",
      fallbackMessage: "Assets requisition request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/assets-requisition`,
        }),
      ),
    );
  }

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: AssetsRequisitionSearchableFields.map((field) => ({
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

  const result = await AssetsRequisition.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true, // Ensure this is added to include soft deleted records
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await AssetsRequisition.count({ where: whereConditions });

  const [count, totalQuantity] = await Promise.all([
    AssetsRequisition.count({ where: whereConditions }),
    AssetsRequisition.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await AssetsRequisition.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

// const removeIdFromDB = async (id) => {
//   const result = await AssetsRequisition.findOne({
//     where: {
//       Id: id,
//     },
//   });

//   if (!result) {
//     throw new ApiError(404, "Asset purchase data not found");
//   }

//   // Soft delete by updating `deletedAt`
//   result.deletedAt = new Date(); // Set current timestamp
//   await result.save(); // Save the updated product with the deleted timestamp

//   return result;
// };

const deleteIdFromDB = async (id) => {
  const result = await AssetsRequisition.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

// const updateOneFromDB = async (id, payload) => {
//   const { name, quantity, price, note, date, status, userId } = payload;

//   console.log("data", payload);

//   const q = quantity === "" || quantity == null ? undefined : Number(quantity);
//   const p = price === "" || price == null ? undefined : Number(price);

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

//   // ✅ Approved হলে পুরোনো date-ও allow + save
//   const isApproved = String(status || "").trim() === "Approved";

//   // ✅ current date না হলে auto Pending
//   const finalStatus = isApproved
//     ? "Approved"
//     : inputDateStr !== todayStr
//       ? "Pending"
//       : "Pending";

//   const data = {
//     name: name === "" ? undefined : name,
//     quantity: q,
//     price: p,
//     note: finalStatus === "Approved" ? null : note || null,
//     status: finalStatus,
//     total: Number.isFinite(p) && Number.isFinite(q) ? p * q : undefined,
//   };

//   const [updatedCount] = await AssetsRequisition.update(data, {
//     where: { Id: id },
//   });

//   // ✅ update না হলে এখানেই থামো
//   if (updatedCount <= 0) return updatedCount;

//   // ✅ শুধু admin/superAdmin/inventory রোলের ইউজার
//   const users = await User.findAll({
//     attributes: ["Id", "role"],
//     where: {
//       Id: { [Op.ne]: userId }, // sender বাদ
//       role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
//     },
//     transaction: t,
//   });

//   console.log("users", users.length);
//   if (!users.length) return updatedCount;

//   const message =
//     finalStatus === "Approved"
//       ? "Assets purchase request approved"
//       : note || "Assets purchase updated";

//   await Promise.all(
//     users.map((u) =>
//       Notification.create(
//         {
//           userId: u.Id,
//           message,
//           url: `/${process.env.APP_BASE_URL}/assets-purchase`,
//         },
//         {
//           transaction: t,
//         },
//       ),
//     ),
//   );

//   return updatedCount;
// };

const updateOneFromDB = async (id, payload) => {
  const { quantity, price, note, date, status, userId, actorRole } = payload;

  const q = quantity === "" || quantity == null ? undefined : Number(quantity);
  const p = price === "" || price == null ? undefined : Number(price);

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await AssetsRequisition.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status", "name", "assetId"],
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

  // ---------- update payload ----------
  const asset = await resolveAsset(payload, existing);
  const finalNote = finalStatus === "Approved" ? null : newNote || null;
  const data = {
    name: asset.name,
    assetId: asset.assetId,
    quantity: q,
    price: p,
    total: Number.isFinite(p) && Number.isFinite(q) ? p * q : undefined,
    date: inputDateStr || undefined,
    note: finalNote,
    status: finalStatus,
  };

  const [updatedCount] = await AssetsRequisition.update(data, {
    where: { Id: id },
  });

  if (updatedCount <= 0) return updatedCount;

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: {
        [Op.in]:
          finalStatus === "Approved" ? ["inventor"] : ["superAdmin", "admin"],
      },
    },
  });

  if (!users.length) return updatedCount;

  const message = resolveApprovalNotificationMessage({
    status: finalStatus,
    note: newNote,
    date: inputDateStr,
    approvedMessage: "Assets requisition request approved",
    fallbackMessage: "Assets requisition request",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/assets-requisition`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await AssetsRequisition.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const AssetsRequisitionService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = AssetsRequisitionService;

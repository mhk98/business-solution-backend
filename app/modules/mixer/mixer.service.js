const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { MixerSearchableFields } = require("./mixer.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const Mixer = db.mixer;
const Notification = db.notification;
const User = db.user;
const ItemMaster = db.itemMaster;
const Product = db.product;
const MIXER_META_PREFIX = "\n__MIXER_META__=";

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const normalizeMaterialName = (value = "") =>
  String(value)
    .replace(/\s+\(Stock:\s*[^)]+\)\s*$/i, "")
    .trim();

const buildMixerNote = (note, mixItems) => {
  const displayNote = String(note || "").trim();
  const serializedMixItems = Array.isArray(mixItems)
    ? mixItems
        .map((item) => ({
          manufactureId: Number(item?.manufactureId),
          unitValue: toNumber(item?.unitValue),
        }))
        .filter((item) => item.manufactureId && item.unitValue > 0)
    : [];

  if (!serializedMixItems.length) {
    return displayNote || null;
  }

  return `${displayNote}${MIXER_META_PREFIX}${JSON.stringify({
    mixItems: serializedMixItems,
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
    const mixItems = Array.isArray(parsedMeta?.mixItems)
      ? parsedMeta.mixItems
          .map((item) => ({
            manufactureId: Number(item?.manufactureId),
            unitValue: toNumber(item?.unitValue),
          }))
          .filter((item) => item.manufactureId && item.unitValue > 0)
      : [];

    return { displayNote, mixItems };
  } catch (error) {
    return {
      displayNote: rawNote.trim(),
      mixItems: [],
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
  if (typeof record.setDataValue === "function") {
    record.setDataValue("note", displayNote || null);
    return record;
  }

  return {
    ...record,
    note: displayNote || null,
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

  const { productId, mixItems, date, note, combo } = payload;

  const productData = await Product.findOne({ where: { Id: productId } });
  if (!productData) throw new ApiError(404, "Product not found");

  const storedNote = buildMixerNote(note, mixItems);

  return db.sequelize.transaction(async (t) => {
    await reconcileItemMasterStock([], mixItems || [], t);

    const result = await Mixer.create(
      {
        productId,
        name: productData.name,
        date,
        combo,
        note: storedNote,
      },
      { transaction: t },
    );

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

    const existingMixItems = await getStoredMixItems(existing, t);
    await reconcileItemMasterStock(existingMixItems, [], t);

    return Mixer.destroy({
      where: { Id: id },
      transaction: t,
    });
  });
};

const updateOneFromDB = async (id, payload) => {
  const { productId, mixItems, note, date, status, userId, actorRole, combo } =
    payload;

  const existing = await Mixer.findOne({
    where: { Id: id },
    attributes: ["Id", "productId", "name", "note", "status", "date", "combo"],
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
    const nextMixItems = Array.isArray(mixItems) ? mixItems : previousMixItems;

    await reconcileItemMasterStock(previousMixItems, nextMixItems, t);

    const finalDisplayNote =
      note === undefined ? oldDisplayNote : String(note || "").trim();
    const storedNote = buildMixerNote(finalDisplayNote, nextMixItems);

    const data = {
      productId: nextProductId || undefined,
      name: productData?.name || lockedMixer.name,
      combo,
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

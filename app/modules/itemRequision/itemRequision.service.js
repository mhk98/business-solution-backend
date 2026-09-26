const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  ItemRequisitionSearchableFields,
} = require("./itemRequision.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const {
  toBaseStockPayload,
} = require("../../../helpers/unitConversionHelper");

const ItemRequisition = db.itemRequisition;
const Item = db.item;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;

const SupplierHistory = db.supplierHistory;

// Receiving a requisition line is what brings the item in: once its status is
// "Item Received" (or later "Completed") it owns one Item Purchase (Item Stock
// + cost at amount ÷ quantity, via the Item Purchase service so stock
// movements and costing follow that path) and one Unpaid SupplierHistory row
// (the supplier's due — Item Purchase itself no longer posts dues). Edits keep
// both in step; moving back to an earlier status or deleting removes them.
// Only lines with supplierDueTracked (created after this change) do this;
// older ones were handled through Item Purchase.
const RECEIVED_STATUSES = new Set(["Item Received", "Completed"]);
// Only an explicit move back to one of these un-receives a line. Workflow
// statuses set around it (e.g. "Pending Delete" while a delete awaits
// approval) must not pull the received stock back out.
const PRE_RECEIPT_STATUSES = new Set(["Pending", "Approved", "Pay For Purchase"]);

const toDateKey = (value) =>
  value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10);

const buildPurchasePayload = (requisition) => ({
  itemId: requisition.itemId,
  unit: requisition.unit || "Pcs",
  unitValue: Number(requisition.quantity || 0),
  cost: Number(requisition.amount || 0),
  date: toDateKey(requisition.date),
  supplierId: normalizeOptionalId(requisition.supplierId),
  note: `Item Requisition #${requisition.Id}`,
});

// Item Purchase stores quantities in base units, so compare in base units.
const sameQuantity = (a, b) => {
  const left = toBaseStockPayload(a.unit || "Pcs", a.unitValue);
  const right = toBaseStockPayload(b.unit || "Pcs", b.unitValue);
  return (
    String(left.unit).toLowerCase() === String(right.unit).toLowerCase() &&
    Math.abs(Number(left.unitValue) - Number(right.unitValue)) < 0.0001
  );
};

const purchaseMatches = (purchase, payload) =>
  Number(purchase.itemId) === Number(payload.itemId) &&
  sameQuantity(purchase, payload) &&
  Number(purchase.cost) === Number(payload.cost) &&
  toDateKey(purchase.date) === payload.date &&
  Number(purchase.supplierId || 0) === Number(payload.supplierId || 0);

// Received quantity joins the item's shared Item Stock row. Once anything has
// gone out of that row after this receipt came in (Mixer, Factory, Stock
// Adjustment…), the receipt's quantity/amount are locked: taking it back or
// re-costing it would rewrite stock that has already been used.
const ITEM_STOCK_TYPES = ["ItemStock", "PackagingStock"];
const STOCK_USED_MESSAGE =
  "This item's received stock has already been used (Mixer/Factory etc.) — quantity, amount and item can't be changed, and it can't be un-received or deleted. Other fields can still be edited.";

const isReceivedStockUsed = async (manufactureId, transaction) => {
  if (!manufactureId) return false;
  const receipt = await db.stockMovement.findOne({
    where: {
      sourceType: "ItemPurchase",
      sourceId: manufactureId,
      stockType: { [Op.in]: ITEM_STOCK_TYPES },
      quantityChange: { [Op.gt]: 0 },
    },
    attributes: ["Id", "stockRowId"],
    order: [["Id", "ASC"]],
    transaction,
  });
  if (!receipt?.stockRowId) return false;

  const usage = await db.stockMovement.findOne({
    where: {
      Id: { [Op.gt]: receipt.Id },
      stockType: { [Op.in]: ITEM_STOCK_TYPES },
      stockRowId: receipt.stockRowId,
      quantityChange: { [Op.lt]: 0 },
      [Op.not]: { sourceType: "ItemPurchase", sourceId: manufactureId },
    },
    attributes: ["Id"],
    transaction,
  });
  return Boolean(usage);
};

const syncItemPurchase = async (requisition, received, transaction) => {
  // Required lazily: the Item Purchase service reads db.itemRequisition.
  const ManufactureService = require("../manufacture/manufacture.service");
  const options = { transaction, fromRequisition: true };
  const manufactureId = normalizeOptionalId(requisition.manufactureId);

  if (!received) {
    if (manufactureId) {
      if (await isReceivedStockUsed(manufactureId, transaction)) {
        throw new ApiError(400, STOCK_USED_MESSAGE);
      }
      await ManufactureService.deleteIdFromDB(manufactureId, options);
      await requisition.update({ manufactureId: null }, { transaction });
    }
    return;
  }

  const payload = buildPurchasePayload(requisition);
  const purchase = manufactureId
    ? await db.manufacture.findOne({ where: { Id: manufactureId }, transaction })
    : null;

  if (!purchase) {
    const created = await ManufactureService.insertIntoDB(payload, options);
    await requisition.update({ manufactureId: created.Id }, { transaction });
    return;
  }

  if (purchaseMatches(purchase, payload)) return;

  const stockChanged =
    Number(purchase.itemId) !== Number(payload.itemId) ||
    !sameQuantity(purchase, payload) ||
    Number(purchase.cost) !== Number(payload.cost);

  if (!(await isReceivedStockUsed(purchase.Id, transaction))) {
    await ManufactureService.updateOneFromDB(purchase.Id, payload, options);
    return;
  }
  if (stockChanged) throw new ApiError(400, STOCK_USED_MESSAGE);

  // Stock already used: only the purchase's own details change (supplier,
  // date) — its stock and cost stay exactly as received.
  await purchase.update(
    { supplierId: payload.supplierId, date: payload.date },
    { transaction },
  );
};

const syncSupplierDue = async (requisition, received, transaction) => {
  const existing = await SupplierHistory.findOne({
    where: { itemRequisitionId: requisition.Id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const supplierId = normalizeOptionalId(requisition.supplierId);
  const amount = Number(requisition.amount || 0);

  if (!received || !supplierId || amount <= 0) {
    if (existing) await existing.destroy({ transaction });
    return;
  }

  const data = {
    supplierId,
    amount,
    status: "Unpaid",
    date: toDateKey(requisition.date),
    itemRequisitionId: requisition.Id,
  };
  if (existing) {
    await existing.update(data, { transaction });
  } else {
    await SupplierHistory.create(data, { transaction });
  }
};

const syncReceipt = async (requisition, transaction) => {
  if (!requisition?.supplierDueTracked) return;
  const status = String(requisition.status || "").trim();
  const received =
    RECEIVED_STATUSES.has(status) ||
    (Boolean(requisition.manufactureId) && !PRE_RECEIPT_STATUSES.has(status));
  await syncItemPurchase(requisition, received, transaction);
  await syncSupplierDue(requisition, received, transaction);
};

const ITEM_REQUISITION_STATUS_UPDATE_ROLES = [
  "superAdmin",
  "admin",
  "accountant",
  "inventor",
];

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

const resolveItem = async (itemId, options = {}) => {
  const normalizedItemId = normalizeOptionalId(itemId);
  if (!normalizedItemId) {
    throw new ApiError(400, "Item is required");
  }

  const item = await Item.findOne({
    where: { Id: normalizedItemId },
    transaction: options.transaction,
  });

  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  return item;
};

const buildPayload = async (data = {}, existing = null, options = {}) => {
  const item = await resolveItem(
    data.itemId !== undefined ? data.itemId : existing?.itemId,
    options,
  );
  const quantity =
    data.quantity !== undefined
      ? Number(data.quantity || 0)
      : existing.quantity;
  const amount =
    data.amount !== undefined ? Number(data.amount || 0) : existing.amount;

  if (Number(quantity) <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return {
    name: item.name,
    itemId: item.Id,
    procurement:
      data.procurement !== undefined
        ? data.procurement || null
        : existing?.procurement || null,
    quantity,
    unit:
      data.unit !== undefined ? data.unit || "Pcs" : existing?.unit || "Pcs",
    amount,
    status:
      data.status !== undefined ? data.status || "Pending" : existing?.status,
    remarks:
      data.remarks !== undefined
        ? data.remarks || null
        : existing?.remarks || null,
    note: data.note !== undefined ? data.note || null : existing?.note || null,
    date: data.date !== undefined ? data.date || null : existing?.date || null,
    supplierId:
      data.supplierId !== undefined
        ? data.supplierId || null
        : existing?.supplierId || null,
    file: data.file !== undefined ? data.file || null : existing?.file || null,
  };
};

const sendCreateNotifications = async ({ userId, status, note, date }, t) => {
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
    transaction: t,
  });

  if (!users.length) return;

  const message = resolveApprovalNotificationMessage({
    status,
    note,
    date,
    approvedMessage: "Item requisition request approved",
    fallbackMessage: "Item requisition request",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create(
        {
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/item-requisition`,
        },
        { transaction: t },
      ),
    ),
  );
};

const insertIntoDB = async (data = {}) => {
  const finalStatus = "Pending";
  let items = [];

  if (typeof data.items === "string") {
    try {
      items = JSON.parse(data.items);
    } catch (e) {
      items = [];
    }
  } else if (Array.isArray(data.items)) {
    items = data.items;
  }

  if (!items.length) {
    items = [data];
  }

  return db.sequelize.transaction(async (t) => {
    const createdRecords = [];

    for (const itemData of items) {
      const mergedData = {
        ...data,
        ...itemData,
        status: finalStatus,
      };
      delete mergedData.items;

      const payload = await buildPayload(mergedData, null, { transaction: t });
      const result = await ItemRequisition.create(
        { ...payload, supplierDueTracked: true },
        { transaction: t },
      );
      createdRecords.push(result);
    }

    await sendCreateNotifications(
      {
        userId: data.userId,
        status: finalStatus,
        note: data.note,
        date: data.date,
      },
      t,
    );

    return createdRecords.length === 1 ? createdRecords[0] : createdRecords;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ItemRequisitionSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
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

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const data = await ItemRequisition.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Item,
        as: "item",
        attributes: ["Id", "name"],
        required: false,
      },
      {
        model: Supplier,
        as: "supplier",
        attributes: ["Id", "name"],
      },
    ],
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const [count, totalQuantity] = await Promise.all([
    ItemRequisition.count({ where: whereConditions }),
    ItemRequisition.sum("quantity", { where: whereConditions }),
  ]);

  // Lets the edit form lock Quantity/Amount/Item once received stock is used.
  await Promise.all(
    data.map(async (row) =>
      row.setDataValue(
        "stockUsed",
        await isReceivedStockUsed(row.manufactureId),
      ),
    ),
  );

  return {
    meta: {
      count,
      totalQuantity: totalQuantity || 0,
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) => {
  const result = await ItemRequisition.findOne({
    where: { Id: id },
    include: [
      {
        model: Item,
        as: "item",
        attributes: ["Id", "name"],
        required: false,
      },
      {
        model: Supplier,
        as: "supplier",
        attributes: ["Id", "name"],
      },
    ],
  });

  return result;
};

const deleteIdFromDB = async (id) =>
  db.sequelize.transaction(async (t) => {
    const existing = await ItemRequisition.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (existing?.manufactureId) {
      if (await isReceivedStockUsed(existing.manufactureId, t)) {
        throw new ApiError(400, STOCK_USED_MESSAGE);
      }
      // Takes the received quantity back out of Item Stock.
      const ManufactureService = require("../manufacture/manufacture.service");
      await ManufactureService.deleteIdFromDB(existing.manufactureId, {
        transaction: t,
        fromRequisition: true,
      });
    }
    await SupplierHistory.destroy({
      where: { itemRequisitionId: id },
      transaction: t,
    });
    return ItemRequisition.destroy({
      where: { Id: id },
      transaction: t,
    });
  });

const updateOneFromDB = async (id, data = {}) => {
  const existing = await ItemRequisition.findOne({
    where: { Id: id },
  });

  if (!existing) {
    throw new ApiError(404, "Item requisition not found");
  }

  const nextStatus =
    data.status !== undefined
      ? String(data.status || "").trim()
      : existing.status;
  const isStatusOnlyUpdate = Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .every((key) => ["status", "note", "userRole"].includes(key));
  const canUpdateStatus = ITEM_REQUISITION_STATUS_UPDATE_ROLES.includes(
    data.userRole,
  );

  if (isStatusOnlyUpdate && nextStatus && canUpdateStatus) {
    return db.sequelize.transaction(async (t) => {
      const payload = {
        status: nextStatus,
        note: data.note !== undefined ? data.note || null : existing.note,
      };

      const [updatedCount] = await ItemRequisition.update(payload, {
        where: { Id: id },
        transaction: t,
      });

      if (!updatedCount) {
        throw new ApiError(400, "Item requisition update failed");
      }

      const updated = await ItemRequisition.findOne({
        where: { Id: id },
        transaction: t,
      });
      await syncReceipt(updated, t);
      return updated;
    });
  }

  return db.sequelize.transaction(async (t) => {
    const payload = await buildPayload(data, existing, { transaction: t });

    const [updatedCount] = await ItemRequisition.update(payload, {
      where: { Id: id },
      transaction: t,
    });

    if (!updatedCount) {
      throw new ApiError(400, "Item requisition update failed");
    }

    const updated = await ItemRequisition.findOne({
      where: { Id: id },
      transaction: t,
    });
    await syncReceipt(updated, t);
    return updated;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await ItemRequisition.findAll({
    include: [
      {
        model: Item,
        as: "item",
        attributes: ["Id", "name"],
        required: false,
      },
    ],
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const ItemRequisitionService = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = ItemRequisitionService;

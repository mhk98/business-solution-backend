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

const ItemRequisition = db.itemRequisition;
const Item = db.item;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const CashInOut = db.cashInOut;
const SupplierHistory = db.supplierHistory;

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

const normalizePaymentDetails = ({ paymentMode, bankName, bankAccount }) => {
  const normalizedPaymentMode = String(paymentMode || "").trim();
  const isBank = normalizedPaymentMode === "Bank";
  const normalizedBankName = String(bankName || "").trim();
  const normalizedBankAccount =
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== ""
      ? Number(bankAccount)
      : null;

  if (
    isBank &&
    normalizedBankAccount !== null &&
    Number.isNaN(normalizedBankAccount)
  ) {
    throw new ApiError(400, "Invalid bank account");
  }

  return {
    paymentMode: normalizedPaymentMode || null,
    bankName: isBank ? normalizedBankName || null : null,
    bankAccount: isBank ? normalizedBankAccount : null,
  };
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
    amount,
    bookId:
      data.bookId !== undefined
        ? data.bookId || null
        : existing?.bookId || null,
    ...normalizePaymentDetails({
      paymentMode:
        data.paymentMode !== undefined
          ? data.paymentMode
          : existing?.paymentMode,
      bankName:
        data.bankName !== undefined ? data.bankName : existing?.bankName,
      bankAccount:
        data.bankAccount !== undefined
          ? data.bankAccount
          : existing?.bankAccount,
    }),
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

const createCompletionEntries = async (
  existing,
  payload = {},
  options = {},
) => {
  const finalStatus = payload.status || existing.status;
  if (finalStatus !== "Completed" || existing.status === "Completed") {
    return;
  }

  const supplierId =
    normalizeOptionalId(payload.supplierId) || existing.supplierId;
  const amount =
    payload.amount !== undefined
      ? Number(payload.amount || 0)
      : Number(existing.amount || 0);

  if (!supplierId || amount <= 0) return;

  const bookId = normalizeOptionalId(payload.bookId) || existing.bookId || null;
  const date =
    payload.date || existing.date || new Date().toISOString().slice(0, 10);
  const itemName = payload.name || existing.name;
  const paymentMode =
    payload.paymentMode !== undefined
      ? payload.paymentMode
      : existing.paymentMode;
  const bankName =
    payload.bankName !== undefined ? payload.bankName : existing.bankName;
  const bankAccount =
    payload.bankAccount !== undefined
      ? payload.bankAccount
      : existing.bankAccount;
  const file = payload.file !== undefined ? payload.file : existing.file;

  await SupplierHistory.create(
    {
      supplierId,
      bookId,
      amount,
      status: "Paid",
      date,
      note: `Item requisition completed: ${itemName}`,
      file: file || null,
    },
    { transaction: options.transaction },
  );

  await CashInOut.create(
    {
      supplierId,
      bookId,
      paymentMode,
      bankName,
      bankAccount,
      paymentStatus: "CashOut",
      amount,
      status: "Active",
      category: "Item Requisition",
      date,
      note: `Item requisition completed: ${itemName}`,
      file: file || null,
    },
    { transaction: options.transaction },
  );
};

const insertIntoDB = async (data = {}) => {
  const finalStatus = "Pending";

  return db.sequelize.transaction(async (t) => {
    const payload = await buildPayload(
      {
        ...data,
        status: finalStatus,
      },
      null,
      { transaction: t },
    );

    const result = await ItemRequisition.create(payload, { transaction: t });

    await sendCreateNotifications(
      {
        userId: data.userId,
        status: finalStatus,
        note: data.note,
        date: data.date,
      },
      t,
    );

    return result;
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

const deleteIdFromDB = async (id) => {
  const result = await ItemRequisition.destroy({
    where: { Id: id },
  });

  return result;
};

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

      await createCompletionEntries(existing, payload, { transaction: t });

      const [updatedCount] = await ItemRequisition.update(payload, {
        where: { Id: id },
        transaction: t,
      });

      if (!updatedCount) {
        throw new ApiError(400, "Item requisition update failed");
      }

      return ItemRequisition.findOne({
        where: { Id: id },
        transaction: t,
      });
    });
  }

  return db.sequelize.transaction(async (t) => {
    const payload = await buildPayload(data, existing, { transaction: t });

    await createCompletionEntries(existing, payload, { transaction: t });

    const [updatedCount] = await ItemRequisition.update(payload, {
      where: { Id: id },
      transaction: t,
    });

    if (!updatedCount) {
      throw new ApiError(400, "Item requisition update failed");
    }

    return ItemRequisition.findOne({
      where: { Id: id },
      transaction: t,
    });
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await ItemRequisition.findAll({
    include: [
      {
        model: Item,
        as: "item",
        attributes: ["Id", "name"],
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

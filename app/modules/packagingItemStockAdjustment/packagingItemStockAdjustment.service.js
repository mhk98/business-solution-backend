const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
  toNumber,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { logStockMovement } = require("../../../shared/stockMovementLogger");
const {
  PackagingItemStockAdjustmentSearchableFields,
} = require("./packagingItemStockAdjustment.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const pkgFifo = require("../../../shared/packagingFifoCostLayers");

const PackagingItemStockAdjustment = db.packagingItemStockAdjustment;
const PackagingItemStock = db.packagingItemStock;
const Notification = db.notification;
const User = db.user;

// Applies a Stock In/Out adjustment's effect on both PackagingItemStock and
// its FIFO cost layers. Mirrors the packagingItemPurchase/packagingFactory
// pattern: "In" opens a fresh layer (found stock has no purchase record, so
// it's valued at the item's current average cost), "Out" draws down the
// oldest layers via consumeFifo. Returns { costBreakdown } (only set for
// "Out") so the caller can persist it for a precise later reversal.
const applyAdjustmentEffect = async ({
  packagingItemId,
  unit,
  unitValue,
  date,
  stock,
  transaction,
}) => {
  const stockRow = await PackagingItemStock.findOne({
    where: { packagingItemId },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["createdAt", "ASC"]],
  });

  if (!stockRow) {
    throw new ApiError(404, "Packaging item stock not found");
  }

  const normalizedPayload = toBaseStockPayload(unit || stockRow.unit, unitValue);
  const totalUnitValue = normalizedPayload.unitValue;

  if (totalUnitValue <= 0) {
    throw new ApiError(400, "unitValue must be greater than 0");
  }

  const currentStockPayload = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
  const availableStock = toNumber(currentStockPayload.unitValue);

  let costBreakdown = null;

  if (stock === "Out") {
    if (availableStock - totalUnitValue < 0) {
      throw new ApiError(400, "Packaging item stock cannot be negative");
    }
    const consumed = await pkgFifo.consumeFifo({
      transaction,
      packagingItemId,
      quantity: totalUnitValue,
    });
    costBreakdown = consumed.costBreakdown;
  } else {
    const currentUnitCost = availableStock > 0 ? toNumber(stockRow.cost) / availableStock : 0;
    const referenceUnitCost = await pkgFifo.currentUnitCost({
      transaction,
      packagingItemId,
      fallback: currentUnitCost,
    });
    await pkgFifo.openLayer({
      transaction,
      packagingItemId,
      unitCost: referenceUnitCost,
      quantity: totalUnitValue,
      receivedDate: date || new Date().toISOString().slice(0, 10),
      sourceType: "PackagingItemStockAdjustment",
    });
  }

  const balanceBefore = availableStock;
  const balanceAfter =
    stock === "In" ? availableStock + totalUnitValue : availableStock - totalUnitValue;
  const delta = stock === "In" ? totalUnitValue : -totalUnitValue;
  const resolvedUnit = currentStockPayload.isConvertedUnit
    ? currentStockPayload.unit
    : normalizedPayload.unit;

  const updatedStockRow = await stockRow.update(
    {
      unit: currentStockPayload.isConvertedUnit ? currentStockPayload.unit : stockRow.unit,
      unitValue: balanceAfter,
    },
    { transaction },
  );

  await pkgFifo.syncItemStockCost({ transaction, packagingItemId });

  return {
    stockRow: updatedStockRow,
    name: stockRow.name,
    unit: resolvedUnit,
    totalUnitValue,
    delta,
    balanceBefore,
    balanceAfter,
    costBreakdown,
  };
};

// Reverses a previously-applied adjustment (used by delete and by update's
// reverse-then-reapply). "In" is undone via unwindInbound (newest-first —
// same heuristic packagingItemPurchase.service.js's own delete uses); "Out"
// is undone precisely via the adjustment's own stored costBreakdown.
const reverseAdjustmentEffect = async ({
  packagingItemId,
  unit,
  unitValue,
  stock,
  costBreakdown,
  transaction,
  movementContext,
}) => {
  const totalUnitValue = toNumber(unitValue);
  if (!packagingItemId || totalUnitValue <= 0) return;

  if (stock === "Out") {
    await pkgFifo.restoreToLayers({ transaction, costBreakdown });
  } else {
    await pkgFifo.unwindInbound({ transaction, packagingItemId, quantity: totalUnitValue });
  }

  const stockRow = await PackagingItemStock.findOne({
    where: { packagingItemId },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["createdAt", "ASC"]],
  });
  if (!stockRow) return;

  const currentStockPayload = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
  const availableStock = toNumber(currentStockPayload.unitValue);
  const delta = stock === "In" ? -totalUnitValue : totalUnitValue;
  const nextStock = availableStock + delta;

  if (nextStock < 0) {
    throw new ApiError(400, "Packaging item stock cannot be negative");
  }

  const updatedStockRow = await stockRow.update(
    {
      unit: currentStockPayload.isConvertedUnit ? currentStockPayload.unit : unit || stockRow.unit,
      unitValue: nextStock,
    },
    { transaction },
  );
  await logStockMovement({
    transaction,
    ...movementContext,
    stockType: "PackagingItemStock",
    stockRow: updatedStockRow,
    itemId: packagingItemId,
    unit: updatedStockRow.unit,
    quantityChange: delta,
    balanceBefore: availableStock,
    balanceAfter: nextStock,
  });

  await pkgFifo.syncItemStockCost({ transaction, packagingItemId });
};

const insertIntoDB = async (payload) => {
  const { packagingItemId, unit, unitValue, date, note, status, stock } = payload;

  if (!packagingItemId) {
    throw new ApiError(400, "packagingItemId is required");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    const effect = await applyAdjustmentEffect({
      packagingItemId,
      unit,
      unitValue,
      date,
      stock,
      transaction: t,
    });

    const adjustmentRecord = await PackagingItemStockAdjustment.create(
      {
        packagingItemId,
        name: effect.name,
        unit: effect.unit,
        unitValue: effect.totalUnitValue,
        date,
        stock,
        note: finalStatus === "Approved" ? null : note || null,
        status: finalStatus,
        costBreakdown: effect.costBreakdown,
      },
      { transaction: t },
    );

    await logStockMovement({
      transaction: t,
      sourceType: "PackagingItemStockAdjustment",
      sourceId: adjustmentRecord.Id,
      operation: "CREATE",
      stockType: "PackagingItemStock",
      stockRow: effect.stockRow,
      itemId: packagingItemId,
      name: effect.name,
      unit: effect.unit,
      quantityChange: effect.delta,
      balanceBefore: effect.balanceBefore,
      balanceAfter: effect.balanceAfter,
    });

    return adjustmentRecord;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PackagingItemStockAdjustmentSearchableFields.map((field) => ({
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

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const [data, count] = await Promise.all([
    PackagingItemStockAdjustment.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingItemStockAdjustment.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const data = await PackagingItemStockAdjustment.findAll({
    where: { packagingItemId: id },
  });
  return data.map(formatStockForDisplay);
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await PackagingItemStockAdjustment.findOne({
      where: { Id: id },
      attributes: ["Id", "packagingItemId", "unit", "unitValue", "stock", "costBreakdown", "date"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    await reverseAdjustmentEffect({
      packagingItemId: existing.packagingItemId,
      unit: existing.unit,
      unitValue: existing.unitValue,
      stock: existing.stock,
      costBreakdown: existing.costBreakdown,
      transaction: t,
      movementContext: {
        sourceType: "PackagingItemStockAdjustment",
        sourceId: existing.Id,
        operation: "DELETE",
        date: existing.date ? String(existing.date).slice(0, 10) : null,
      },
    });

    return PackagingItemStockAdjustment.destroy({ where: { Id: id }, transaction: t });
  });
};

const updateOneFromDB = async (id, payload) => {
  const { unit, unitValue, note, date, status, userId, actorRole, stock } = payload;

  const existing = await PackagingItemStockAdjustment.findOne({
    where: { Id: id },
    attributes: [
      "Id",
      "packagingItemId",
      "name",
      "unit",
      "unitValue",
      "date",
      "note",
      "status",
      "stock",
      "costBreakdown",
    ],
  });

  if (!existing) return 0;

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();
  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
  const dateTriggersPending = Boolean(inputDateStr) && inputDateStr !== todayStr;
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

  const normalizedPayload =
    unitValue === "" || unitValue == null
      ? toBaseStockPayload(existing.unit, existing.unitValue)
      : toBaseStockPayload(unit === "" || unit == null ? existing.unit : unit, unitValue);
  const nextStock = stock === "" || stock == null ? existing.stock : stock;

  const updatedCount = await db.sequelize.transaction(async (t) => {
    await reverseAdjustmentEffect({
      packagingItemId: existing.packagingItemId,
      unit: existing.unit,
      unitValue: existing.unitValue,
      stock: existing.stock,
      costBreakdown: existing.costBreakdown,
      transaction: t,
      movementContext: {
        sourceType: "PackagingItemStockAdjustment",
        sourceId: id,
        operation: "UPDATE_REVERSE",
        date: existing.date ? String(existing.date).slice(0, 10) : null,
      },
    });

    const effect = await applyAdjustmentEffect({
      packagingItemId: existing.packagingItemId,
      unit: normalizedPayload.unit,
      unitValue: normalizedPayload.unitValue,
      date: inputDateStr || existing.date,
      stock: nextStock,
      transaction: t,
    });

    const data = {
      unit: effect.unit,
      unitValue: effect.totalUnitValue,
      stock: nextStock,
      note: finalStatus === "Approved" ? null : newNote || null,
      status: finalStatus,
      date: inputDateStr || existing.date || undefined,
      costBreakdown: effect.costBreakdown,
    };

    const [count] = await PackagingItemStockAdjustment.update(data, {
      where: { Id: id },
      transaction: t,
    });

    await logStockMovement({
      transaction: t,
      sourceType: "PackagingItemStockAdjustment",
      sourceId: id,
      operation: "UPDATE",
      stockType: "PackagingItemStock",
      stockRow: effect.stockRow,
      itemId: existing.packagingItemId,
      name: effect.name,
      unit: effect.unit,
      quantityChange: effect.delta,
      balanceBefore: effect.balanceBefore,
      balanceAfter: effect.balanceAfter,
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
    approvedMessage: "PackagingItemStockAdjustment request approved",
    fallbackMessage: "PackagingItemStockAdjustment updated",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/packaging-item-stock-adjustment`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const data = await PackagingItemStockAdjustment.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(formatStockForDisplay);
};

const PackagingItemStockAdjustmentService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PackagingItemStockAdjustmentService;

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
  PackagingFactoryStockAdjustmentSearchableFields,
} = require("./packagingFactoryStockAdjustment.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");

const PackagingFactoryStockAdjustment = db.packagingFactoryStockAdjustment;
const PackagingFactoryStock = db.packagingFactoryStock;
const Notification = db.notification;
const User = db.user;

const getStockDirectionMultiplier = (stock) =>
  String(stock || "").trim() === "In" ? 1 : -1;

const normalizeAdjustmentForStockEffect = (adjustment = {}) => {
  const basePayload = toBaseStockPayload(adjustment.unit, adjustment.unitValue);

  return {
    ...adjustment,
    unit: basePayload.unit,
    unitValue: basePayload.unitValue,
  };
};

// Reconciles a manual Packaging Factory Stock adjustment's effect on
// PackagingFactoryStock — same "combine previous + next into one net delta"
// plus proportional cost movement as factoryStockAdjustment.service.js's
// reconcileManufactureStockAdjustment (PackagingFactoryStock also carries a
// flat scalar `cost`, not a FIFO layer table).
const reconcilePackagingFactoryStockAdjustment = async (
  previousAdjustment,
  nextAdjustment,
  transaction,
  movementContext = null,
) => {
  previousAdjustment = previousAdjustment
    ? normalizeAdjustmentForStockEffect(previousAdjustment)
    : null;
  nextAdjustment = nextAdjustment
    ? normalizeAdjustmentForStockEffect(nextAdjustment)
    : null;

  const previousEffects = new Map();
  const nextEffects = new Map();

  if (
    previousAdjustment?.packagingFactoryStockId &&
    previousAdjustment?.unitValue > 0
  ) {
    previousEffects.set(
      Number(previousAdjustment.packagingFactoryStockId),
      getStockDirectionMultiplier(previousAdjustment.stock) *
        toNumber(previousAdjustment.unitValue),
    );
  }

  if (
    nextAdjustment?.packagingFactoryStockId &&
    nextAdjustment?.unitValue > 0
  ) {
    nextEffects.set(
      Number(nextAdjustment.packagingFactoryStockId),
      getStockDirectionMultiplier(nextAdjustment.stock) *
        toNumber(nextAdjustment.unitValue),
    );
  }

  const stockIds = new Set([...previousEffects.keys(), ...nextEffects.keys()]);

  for (const packagingFactoryStockId of stockIds) {
    const previousEffect = toNumber(previousEffects.get(packagingFactoryStockId));
    const nextEffect = toNumber(nextEffects.get(packagingFactoryStockId));
    const delta = nextEffect - previousEffect;

    if (!delta) continue;

    const stockRow = await PackagingFactoryStock.findOne({
      where: { Id: packagingFactoryStockId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stockRow) {
      throw new ApiError(
        404,
        `Packaging factory stock row ${packagingFactoryStockId} not found`,
      );
    }

    const currentStockPayload = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
    const availableStock = toNumber(currentStockPayload.unitValue);
    const nextStock = availableStock + delta;

    if (nextStock < 0) {
      throw new ApiError(400, "Packaging factory stock cannot be negative");
    }

    const currentCost = toNumber(stockRow.cost);
    const currentUnitCost = availableStock > 0 ? currentCost / availableStock : 0;
    const nextCost = Math.max(0, currentCost + delta * currentUnitCost);

    const updatedStockRow = await stockRow.update(
      {
        unit: currentStockPayload.isConvertedUnit ? currentStockPayload.unit : stockRow.unit,
        unitValue: nextStock,
        cost: nextCost,
      },
      { transaction },
    );

    await logStockMovement({
      transaction,
      ...movementContext,
      stockType: movementContext?.stockType || "PackagingFactoryStock",
      stockRow: updatedStockRow,
      itemId: stockRow.packagingItemId,
      manufacturerId: stockRow.manufacturerId || null,
      name: stockRow.name,
      unit: currentStockPayload.isConvertedUnit ? currentStockPayload.unit : stockRow.unit,
      quantityChange: delta,
      balanceBefore: availableStock,
      balanceAfter: nextStock,
    });
  }
};

const insertIntoDB = async (payload) => {
  const { packagingFactoryStockId, unit, unitValue, date, note, status, stock } = payload;

  if (!packagingFactoryStockId) {
    throw new ApiError(400, "packagingFactoryStockId is required");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    const stockRow = await PackagingFactoryStock.findOne({
      where: { Id: packagingFactoryStockId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockRow) {
      throw new ApiError(
        404,
        `Packaging factory stock row ${packagingFactoryStockId} not found`,
      );
    }

    const normalizedPayload = toBaseStockPayload(unit || stockRow.unit, unitValue);
    const totalUnitValue = normalizedPayload.unitValue;

    if (totalUnitValue <= 0) {
      throw new ApiError(400, "unitValue must be greater than 0");
    }

    const currentStockPayload = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
    const availableStock = toNumber(currentStockPayload.unitValue);
    const plusQuantity = availableStock + totalUnitValue;
    const minusQuantity = availableStock - totalUnitValue;

    if (stock === "Out" && minusQuantity < 0) {
      throw new ApiError(400, "Packaging factory stock cannot be negative");
    }

    const balanceBefore = availableStock;
    const balanceAfter = stock === "In" ? plusQuantity : minusQuantity;
    const delta = stock === "In" ? totalUnitValue : -totalUnitValue;

    const currentCost = toNumber(stockRow.cost);
    const currentUnitCost = availableStock > 0 ? currentCost / availableStock : 0;
    const nextCost = Math.max(0, currentCost + delta * currentUnitCost);

    const resolvedUnit = currentStockPayload.isConvertedUnit
      ? currentStockPayload.unit
      : normalizedPayload.unit;

    const adjustmentRecord = await PackagingFactoryStockAdjustment.create(
      {
        packagingFactoryStockId,
        packagingItemId: stockRow.packagingItemId || null,
        manufacturerId: stockRow.manufacturerId || null,
        manufacturerName: stockRow.manufacturerName || null,
        name: stockRow.name,
        unit: resolvedUnit,
        unitValue: totalUnitValue,
        date,
        stock,
        note: finalStatus === "Approved" ? null : note || null,
        status: finalStatus,
      },
      { transaction: t },
    );

    const updatedStockRow = await stockRow.update(
      {
        unit: currentStockPayload.isConvertedUnit ? currentStockPayload.unit : stockRow.unit,
        unitValue: balanceAfter,
        cost: nextCost,
      },
      { transaction: t },
    );

    await logStockMovement({
      transaction: t,
      sourceType: "PackagingFactoryStockAdjustment",
      sourceId: adjustmentRecord.Id,
      operation: "CREATE",
      stockType: "PackagingFactoryStock",
      stockRow: updatedStockRow,
      itemId: stockRow.packagingItemId,
      manufacturerId: stockRow.manufacturerId || null,
      name: stockRow.name,
      unit: resolvedUnit,
      quantityChange: delta,
      balanceBefore,
      balanceAfter,
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
      [Op.or]: PackagingFactoryStockAdjustmentSearchableFields.map((field) => ({
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
    PackagingFactoryStockAdjustment.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    PackagingFactoryStockAdjustment.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const data = await PackagingFactoryStockAdjustment.findAll({
    where: { packagingFactoryStockId: id },
  });
  return data.map(formatStockForDisplay);
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await PackagingFactoryStockAdjustment.findOne({
      where: { Id: id },
      attributes: ["Id", "packagingFactoryStockId", "unit", "unitValue", "stock"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    await reconcilePackagingFactoryStockAdjustment(
      {
        packagingFactoryStockId: existing.packagingFactoryStockId,
        unit: existing.unit,
        unitValue: existing.unitValue,
        stock: existing.stock,
      },
      null,
      t,
      {
        sourceType: "PackagingFactoryStockAdjustment",
        sourceId: existing.Id,
        operation: "DELETE",
        stockType: "PackagingFactoryStock",
      },
    );

    return PackagingFactoryStockAdjustment.destroy({ where: { Id: id }, transaction: t });
  });
};

const updateOneFromDB = async (id, payload) => {
  const { unit, unitValue, note, date, status, userId, actorRole, stock } = payload;

  const existing = await PackagingFactoryStockAdjustment.findOne({
    where: { Id: id },
    attributes: [
      "Id",
      "packagingFactoryStockId",
      "packagingItemId",
      "manufacturerId",
      "manufacturerName",
      "name",
      "unit",
      "unitValue",
      "date",
      "note",
      "status",
      "stock",
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
  const totalUnitValue = normalizedPayload.unitValue;
  const nextStock = stock === "" || stock == null ? existing.stock : stock;

  const data = {
    unit: normalizedPayload.unit,
    unitValue: totalUnitValue,
    stock: nextStock,
    note: finalStatus === "Approved" ? null : newNote || null,
    status: finalStatus,
    date: inputDateStr || existing.date || undefined,
  };

  const updatedCount = await db.sequelize.transaction(async (t) => {
    await reconcilePackagingFactoryStockAdjustment(
      {
        packagingFactoryStockId: existing.packagingFactoryStockId,
        unit: existing.unit,
        unitValue: existing.unitValue,
        stock: existing.stock,
      },
      {
        packagingFactoryStockId: existing.packagingFactoryStockId,
        unit: normalizedPayload.unit,
        unitValue: totalUnitValue,
        stock: nextStock,
      },
      t,
      {
        sourceType: "PackagingFactoryStockAdjustment",
        sourceId: id,
        operation: "UPDATE",
        stockType: "PackagingFactoryStock",
      },
    );

    const [count] = await PackagingFactoryStockAdjustment.update(data, {
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
    approvedMessage: "PackagingFactoryStockAdjustment request approved",
    fallbackMessage: "PackagingFactoryStockAdjustment updated",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/packaging-factory-stock-adjustment`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const data = await PackagingFactoryStockAdjustment.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(formatStockForDisplay);
};

const PackagingFactoryStockAdjustmentService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PackagingFactoryStockAdjustmentService;

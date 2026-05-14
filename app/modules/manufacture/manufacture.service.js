const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
  toNumber,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ManufactureSearchableFields } = require("./manufacture.constants");
const Manufacture = db.manufacture;
const Notification = db.notification;
const User = db.user;
const Item = db.item;
const Supplier = db.supplier;
const ItemMaster = db.itemMaster;

const normalizeUnitPayload = (unit, unitValue) => {
  return toBaseStockPayload(unit, unitValue);
};

const insertIntoDB = async (payload) => {
  const {
    itemId,
    productId,
    unit,
    unitValue,
    cost,
    date,
    note,
    status,
    supplierId,
  } = payload;

  const itemData = await Item.findOne({ where: { Id: itemId } });
  if (!itemData) throw new ApiError(404, "Item not found");

  const normalizedPayload = normalizeUnitPayload(unit, unitValue);
  const totalUnitValue = normalizedPayload.unitValue;
  const totalCost = toNumber(cost);

  if (totalUnitValue <= 0) {
    throw new ApiError(400, "unitValue must be greater than 0");
  }

  const calculatedUnitCost =
    totalUnitValue > 0 ? totalCost / totalUnitValue : 0;
  const finalStatus = String(status || "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    const manufactureData = {
      itemId,
      productId: productId || null,
      name: itemData.name,
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      cost: totalCost,
      supplierId,

      // unitCost: calculatedUnitCost,
      date,
      note: finalStatus === "Approved" ? null : note || null,
      status: finalStatus,
    };

    const stockRow = await ItemMaster.findOne({
      where: { itemId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (stockRow) {
      const currentStockPayload = toBaseStockPayload(
        stockRow.unit,
        stockRow.unitValue,
      );
      const nextQuantity = currentStockPayload.unitValue + totalUnitValue;
      await stockRow.update(
        {
          itemId,
          productId: productId || stockRow.productId || null,
          name: itemData.name,
          unit: currentStockPayload.isWeightUnit
            ? "Gram"
            : normalizedPayload.unit,
          unitValue: nextQuantity,
          // unitCost: calculatedUnitCost,
          cost: nextQuantity * calculatedUnitCost,
        },
        { transaction: t },
      );
    } else {
      await ItemMaster.create(
        {
          itemId,
          productId: productId || null,
          name: itemData.name,
          unit: normalizedPayload.unit,
          unitValue: totalUnitValue,
          // unitCost: calculatedUnitCost,

          cost: totalCost,
        },
        { transaction: t },
      );
    }

    return Manufacture.create(manufactureData, { transaction: t });
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureSearchableFields.map((field) => ({
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
    Manufacture.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      include: [
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
    }),
    Manufacture.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const data = await Manufacture.findAll({ where: { productId: id } });
  return data.map(formatStockForDisplay);
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    const existing = await Manufacture.findOne({
      where: { Id: id },
      attributes: ["Id", "itemId", "productId"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    await ItemMaster.destroy({
      where: {
        itemId: existing.itemId,
        productId: existing.productId || null,
      },
      transaction: t,
    });

    return Manufacture.destroy({
      where: { Id: id },
      transaction: t,
    });
  });
};

const updateOneFromDB = async (id, payload) => {
  const {
    itemId,
    productId,
    name,
    unit,
    unitValue,
    cost,
    note,
    date,
    status,
    supplierId,
    userId,
  } = payload;

  const existing = await Manufacture.findOne({
    where: { Id: id },
    attributes: [
      "Id",
      "itemId",
      "productId",
      "name",
      "unit",
      "unitValue",
      "cost",
      "note",
      "status",
    ],
  });

  if (!existing) return 0;

  const newNote = String(note || "").trim();
  const inputStatus = String(status || "").trim();
  const finalStatus = inputStatus || existing.status || "Pending";

  const nextUnitInput = unit === "" || unit == null ? existing.unit : unit;
  const nextUnitValueInput =
    unitValue === "" || unitValue == null ? existing.unitValue : unitValue;
  const normalizedPayload = normalizeUnitPayload(
    nextUnitInput,
    nextUnitValueInput,
  );
  const totalUnitValue = normalizedPayload.unitValue;
  const totalCost = cost === "" || cost == null ? undefined : toNumber(cost);
  const nextTotalCost =
    totalCost === undefined ? toNumber(existing.cost) : totalCost;
  const nextItemId = itemId || existing.itemId;
  const nextProductId =
    productId === "" || productId == null ? existing.productId : productId;
  const nextName = name === "" || name == null ? existing.name : name;

  const data = {
    itemId: nextItemId,
    productId: nextProductId,
    name: nextName,
    unit: normalizedPayload.unit,
    unitValue: totalUnitValue,
    cost: nextTotalCost,
    supplierId,
    // unitCost: totalUnitValue > 0 ? nextTotalCost / totalUnitValue : undefined,
    note: finalStatus === "Approved" ? null : newNote || null,
    status: finalStatus,
    date: String(date || "").slice(0, 10) || undefined,
  };

  const oldItemId = existing.itemId;
  const existingBasePayload = toBaseStockPayload(
    existing.unit,
    existing.unitValue,
  );
  const oldUnitValue = existingBasePayload.unitValue;

  const updatedCount = await db.sequelize.transaction(async (t) => {
    const oldStockRow = await ItemMaster.findOne({
      where: { itemId: oldItemId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (oldStockRow) {
      const oldStockPayload = toBaseStockPayload(
        oldStockRow.unit,
        oldStockRow.unitValue,
      );
      const reducedQuantity = oldStockPayload.unitValue - oldUnitValue;

      // if (reducedQuantity < 0) {
      //   throw new ApiError(400, "Item stock cannot be negative");
      // }

      await oldStockRow.update(
        {
          unitValue: reducedQuantity,
          cost: reducedQuantity * toNumber(oldStockRow.unitCost),
        },
        { transaction: t },
      );
    }

    let targetStockRow = oldStockRow;
    if (Number(oldItemId) !== Number(nextItemId)) {
      targetStockRow = await ItemMaster.findOne({
        where: { itemId: nextItemId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    }

    const nextUnitCost =
      totalUnitValue > 0 ? nextTotalCost / totalUnitValue : 0;

    if (!targetStockRow) {
      await ItemMaster.create(
        {
          itemId: nextItemId,
          productId: nextProductId || null,
          name: nextName,
          unit: normalizedPayload.unit,
          unitValue: totalUnitValue,
          // unitCost: nextUnitCost,
          cost: nextTotalCost,
        },
        { transaction: t },
      );
    } else {
      const targetStockPayload = toBaseStockPayload(
        targetStockRow.unit,
        targetStockRow.unitValue,
      );
      const mergedQuantity = targetStockPayload.unitValue + totalUnitValue;

      await targetStockRow.update(
        {
          itemId: nextItemId,
          productId: nextProductId || targetStockRow.productId || null,
          name: nextName,
          unit: targetStockPayload.isWeightUnit
            ? "Gram"
            : normalizedPayload.unit,
          unitValue: mergedQuantity,
          // unitCost: nextUnitCost,
          cost: mergedQuantity * nextUnitCost,
        },
        { transaction: t },
      );
    }

    const [count] = await Manufacture.update(data, {
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

  const message =
    finalStatus === "Approved"
      ? "Manufacture request approved"
      : newNote || "Manufacture updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/manufacture`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const data = await Manufacture.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
  return data.map(formatStockForDisplay);
};

const ManufactureService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ManufactureService;

const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
  toNumber,
} = require("../../../helpers/unitConversionHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ManufactureSearchableFields } = require("./manufacture.constants");
const { logStockMovement } = require("../../../shared/stockMovementLogger");
const itemFifo = require("../../../shared/itemFifoCostLayers");
const Manufacture = db.manufacture;
const Notification = db.notification;
const User = db.user;
const Item = db.item;
const Supplier = db.supplier;
const ItemMaster = db.itemMaster;
const SupplierHistory = db.supplierHistory;
const { Op, Sequelize } = require("sequelize");

const parseVariantPayload = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const buildVariantKey = (variant) => {
  const normalized = parseVariantPayload(variant);
  if (!normalized) return null;

  const entries = Object.entries(normalized)
    .map(([key, value]) => [key, String(value || "").trim()])
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) return null;
  return entries.map(([key, value]) => `${key}:${value}`).join("|");
};

const buildStockWhere = ({ itemId, productId, variantKey }) => {
  const where = { itemId };

  if (productId) {
    where.productId = productId;
  }

  if (variantKey) {
    where.variantKey = variantKey;
  } else {
    const emptyVariantCondition = {
      [Op.or]: [{ variantKey: null }, { variantKey: "" }],
    };

    if (where[Op.and]) {
      where[Op.and].push(emptyVariantCondition);
    } else {
      where[Op.and] = [emptyVariantCondition];
    }
  }

  return where;
};

const normalizeUnitPayload = (unit, unitValue) => {
  return toBaseStockPayload(unit, unitValue);
};

const formatManufactureForDisplay = (record) => {
  const formatted = formatStockForDisplay(record);
  const relatedItemName = formatted?.Item?.name;

  return relatedItemName ? { ...formatted, name: relatedItemName } : formatted;
};

const adjustStockBalance = async ({
  Model,
  stockLabel,
  itemId,
  productId,
  name,
  variant,
  variantKey,
  unit,
  unitValue,
  cost = 0,
  delta,
  transaction,
  createOnPositive = false,
  ignoreMissingOnNegative = false,
  movementContext = null,
}) => {
  if (!delta) return null;

  const stockRow = await Model.findOne({
    where: buildStockWhere({ itemId, productId, variantKey }),
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["createdAt", "ASC"]],
  });

  if (!stockRow) {
    if (createOnPositive && delta > 0) {
      const createdStockRow = await Model.create(
        {
          itemId,
          productId: productId || null,
          name,
          variant,
          variantKey: variantKey || null,
          unit,
          unitValue: delta,
          cost: toNumber(cost),
        },
        { transaction },
      );
      await logStockMovement({
        transaction,
        ...movementContext,
        stockType: movementContext?.stockType || stockLabel,
        stockRow: createdStockRow,
        itemId,
        productId: productId || null,
        name,
        variant,
        variantKey: variantKey || null,
        unit,
        quantityChange: delta,
        balanceBefore: 0,
        balanceAfter: delta,
      });
      return createdStockRow;
    }

    if (ignoreMissingOnNegative && delta < 0) {
      return null;
    }

    throw new ApiError(404, `${stockLabel} not found for selected item`);
  }

  const currentStockPayload = toBaseStockPayload(
    stockRow.unit,
    stockRow.unitValue,
  );
  const nextQuantity = currentStockPayload.unitValue + delta;

  if (nextQuantity < 0) {
    throw new ApiError(400, `${stockLabel} cannot be negative`);
  }

  const currentCost = toNumber(stockRow.cost);
  const currentUnitCost =
    currentStockPayload.unitValue > 0
      ? currentCost / currentStockPayload.unitValue
      : 0;
  const nextCost =
    delta > 0
      ? currentCost + toNumber(cost)
      : Math.max(0, currentCost + delta * currentUnitCost);

  const updatedStockRow = await stockRow.update(
    {
      itemId,
      productId: productId || stockRow.productId || null,
      name,
      variant,
      variantKey: variantKey || null,
      unit: currentStockPayload.isConvertedUnit
        ? currentStockPayload.unit
        : unit,
      unitValue: nextQuantity,
      cost: nextCost,
    },
    { transaction },
  );
  await logStockMovement({
    transaction,
    ...movementContext,
    stockType: movementContext?.stockType || stockLabel,
    stockRow: updatedStockRow,
    itemId,
    productId: productId || stockRow.productId || null,
    name,
    variant,
    variantKey: variantKey || null,
    unit: currentStockPayload.isConvertedUnit ? currentStockPayload.unit : unit,
    quantityChange: delta,
    balanceBefore: currentStockPayload.unitValue,
    balanceAfter: nextQuantity,
  });
  return updatedStockRow;
};

// Same-item edit path: instead of fully reversing the old purchase's stock
// contribution and reapplying the new one (adjustStockBalance's normal
// two-step, needed when the item/product/variant is actually changing to a
// different stock row), apply the NET change in one step. The two-step
// approach rejects the edit the instant the old quantity alone doesn't fit
// in currently-available stock (e.g. some of it has since been sold or sent
// to a mixer) — even when the edit itself doesn't need that headroom, e.g.
// only Unit Cost, Supplier, Date or Status changed. This also removes
// exactly what this purchase originally contributed to the stock's cost
// (oldCost) and adds exactly what it should now contribute (nextTotalCost),
// which is more precise than adjustStockBalance's weighted-average estimate
// for a stock row that's since been mixed with other purchases.
const adjustStockBalanceForSameTarget = async ({
  Model,
  stockLabel,
  itemId,
  productId,
  name,
  variant,
  variantKey,
  unit,
  quantityDelta,
  costDelta,
  transaction,
  movementContext,
}) => {
  if (!quantityDelta && !costDelta) return null;

  const stockRow = await Model.findOne({
    where: buildStockWhere({ itemId, productId, variantKey }),
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["createdAt", "ASC"]],
  });

  if (!stockRow) {
    throw new ApiError(404, `${stockLabel} not found for selected item`);
  }

  const currentStockPayload = toBaseStockPayload(
    stockRow.unit,
    stockRow.unitValue,
  );
  const nextQuantity = currentStockPayload.unitValue + quantityDelta;

  if (nextQuantity < 0) {
    throw new ApiError(400, `${stockLabel} cannot be negative`);
  }

  const nextCost = Math.max(0, toNumber(stockRow.cost) + costDelta);
  const nextUnit = currentStockPayload.isConvertedUnit
    ? currentStockPayload.unit
    : unit;

  const updatedStockRow = await stockRow.update(
    {
      itemId,
      productId: productId || stockRow.productId || null,
      name,
      variant,
      variantKey: variantKey || null,
      unit: nextUnit,
      unitValue: nextQuantity,
      cost: nextCost,
    },
    { transaction },
  );

  await logStockMovement({
    transaction,
    ...movementContext,
    stockType: movementContext?.stockType || stockLabel,
    stockRow: updatedStockRow,
    itemId,
    productId: productId || stockRow.productId || null,
    name,
    variant,
    variantKey: variantKey || null,
    unit: nextUnit,
    quantityChange: quantityDelta,
    balanceBefore: currentStockPayload.unitValue,
    balanceAfter: nextQuantity,
  });

  return updatedStockRow;
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
    variant,
    variantKey,
  } = payload;

  const itemData = await Item.findOne({ where: { Id: itemId } });
  if (!itemData) throw new ApiError(404, "Item not found");

  const normalizedPayload = normalizeUnitPayload(unit, unitValue);
  const totalUnitValue = normalizedPayload.unitValue;
  const totalCost = toNumber(cost);
  const normalizedVariant = parseVariantPayload(variant);
  const normalizedVariantKey = variantKey || buildVariantKey(normalizedVariant);

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
      variant: normalizedVariant,
      variantKey: normalizedVariantKey,
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      cost: totalCost,
      supplierId,

      // unitCost: calculatedUnitCost,
      date,
      note: finalStatus === "Approved" ? null : note || null,
      status: finalStatus,
    };

    const manufactureRecord = await Manufacture.create(manufactureData, {
      transaction: t,
    });

    await adjustStockBalance({
      Model: ItemMaster,
      stockLabel: "Item stock",
      itemId,
      productId,
      name: itemData.name,
      variant: normalizedVariant,
      variantKey: normalizedVariantKey,
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      cost: totalCost,
      delta: totalUnitValue,
      transaction: t,
      createOnPositive: true,
      movementContext: {
        sourceType: "ItemPurchase",
        sourceId: manufactureRecord.Id,
        operation: "CREATE",
        stockType: "ItemStock",
      },
    });

    // FIFO: raw-material item purchases open a cost layer at Item Stock level.
    if (!productId) {
      await itemFifo.openLayer({
        transaction: t,
        itemId,
        unitCost: calculatedUnitCost,
        quantity: totalUnitValue,
        receivedDate: date || new Date().toISOString().slice(0, 10),
        sourceType: "ItemPurchase",
        sourceMovementId: manufactureRecord.Id,
      });
      await itemFifo.syncItemStockCost({ transaction: t, itemId });
    }

    // Linked SupplierHistory row so this purchase's due/paid tracking can be
    // found and kept in sync later (see updateOneFromDB) — one row per
    // purchase line, not batched, so an edit to one item never has to guess
    // which shared row to adjust.
    if (supplierId && totalCost > 0) {
      await SupplierHistory.create(
        {
          supplierId,
          manufactureId: manufactureRecord.Id,
          amount: totalCost,
          status: "Unpaid",
          date: date || new Date().toISOString().slice(0, 10),
        },
        { transaction: t },
      );
    }

    return manufactureRecord;
  });
};

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);
//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;
//   const itemNameFilter = String(otherFilters.name || "").trim();
//   delete otherFilters.name;

//   const andConditions = [];

//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: ManufactureSearchableFields.map((field) => ({
//         [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
//       })),
//     });
//   }

//   if (Object.keys(otherFilters).length) {
//     andConditions.push(
//       ...Object.entries(otherFilters).map(([key, value]) => ({
//         [key]: { [Op.eq]: value },
//       })),
//     );
//   }

//   if (itemNameFilter) {
//     const matchingItems = await Item.findAll({
//       attributes: ["Id"],
//       where: { name: { [Op.eq]: itemNameFilter } },
//       paranoid: true,
//     });
//     const itemIds = matchingItems.map((item) => item.Id);

//     andConditions.push({
//       [Op.or]: [
//         { name: { [Op.eq]: itemNameFilter } },
//         ...(itemIds.length ? [{ itemId: { [Op.in]: itemIds } }] : []),
//       ],
//     });
//   }

//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       date: { [Op.between]: [start, end] },
//     });
//   }

//   andConditions.push({ deletedAt: { [Op.is]: null } });

//   const whereConditions = andConditions.length
//     ? { [Op.and]: andConditions }
//     : {};

//   const [data, count] = await Promise.all([
//     Manufacture.findAll({
//       where: whereConditions,
//       offset: skip,
//       limit,
//       include: [
//         {
//           model: Supplier,
//           as: "supplier",
//           attributes: ["Id", "name"],
//         },
//         {
//           model: Item,
//           attributes: ["Id", "name"],
//         },
//       ],
//       paranoid: true,
//       order:
//         options.sortBy && options.sortOrder
//           ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//           : [["createdAt", "DESC"]],
//     }),
//     Manufacture.count({ where: whereConditions }),
//   ]);

//   return {
//     meta: { page, limit, count },
//     data: data.map(formatManufactureForDisplay),
//   };
// };

const getAllFromDB = async (filters, options) => {
  // maxLimit raised so the report export (Item Purchase History PDF) can
  // pull the full filtered data set in one request, not just a page.
  const { page, limit, skip } = paginationHelpers.calculatePagination(options, {
    maxLimit: 5000,
  });

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const itemNameFilter = String(otherFilters.name || "").trim();
  delete otherFilters.name;

  const andConditions = [];

  // Search
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureSearchableFields.map((field) => ({
        [field]: {
          [Op.iLike]: `%${searchTerm.trim()}%`,
        },
      })),
    });
  }

  // Other filters
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: {
          [Op.eq]: value,
        },
      })),
    );
  }

  // Item name filter
  if (itemNameFilter) {
    const matchingItems = await Item.findAll({
      attributes: ["Id"],
      where: {
        name: {
          [Op.eq]: itemNameFilter,
        },
      },
      paranoid: true,
    });

    const itemIds = matchingItems.map((item) => item.Id);

    andConditions.push({
      [Op.or]: [
        {
          name: {
            [Op.eq]: itemNameFilter,
          },
        },

        ...(itemIds.length
          ? [
              {
                itemId: {
                  [Op.in]: itemIds,
                },
              },
            ]
          : []),
      ],
    });
  }

  // Date filter
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: {
        [Op.between]: [start, end],
      },
    });
  }

  // Soft delete filter
  andConditions.push({
    deletedAt: {
      [Op.is]: null,
    },
  });

  const whereConditions = andConditions.length
    ? {
        [Op.and]: andConditions,
      }
    : {};

  const [data, count, totalPurchaseResult] = await Promise.all([
    // Data
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

        {
          model: Item,
          attributes: ["Id", "name"],
        },
      ],

      paranoid: true,

      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),

    // Total entries
    Manufacture.count({
      where: whereConditions,
    }),

    // Total purchase amount — `cost` already stores the line's total cost
    // (unitValue * unit cost, set at insert time), so it must be summed
    // as-is rather than multiplied by unitValue again.
    Manufacture.findOne({
      where: whereConditions,

      attributes: [[Sequelize.fn("SUM", Sequelize.col("cost")), "totalPurchaseAmount"]],

      raw: true,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      count,

      totalPurchaseAmount: Number(
        totalPurchaseResult?.totalPurchaseAmount || 0,
      ),
    },

    data: data.map(formatManufactureForDisplay),
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
      attributes: [
        "Id",
        "itemId",
        "productId",
        "name",
        "variant",
        "variantKey",
        "unit",
        "unitValue",
        "cost",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const existingBasePayload = toBaseStockPayload(
      existing.unit,
      existing.unitValue,
    );
    const oldUnitValue = existingBasePayload.unitValue;
    const oldCost = toNumber(existing.cost);
    const oldVariant = parseVariantPayload(existing.variant);

    await adjustStockBalance({
      Model: ItemMaster,
      stockLabel: "Item stock",
      itemId: existing.itemId,
      productId: existing.productId || null,
      name: existing.name,
      variant: oldVariant,
      variantKey: existing.variantKey || null,
      unit: existingBasePayload.unit,
      unitValue: oldUnitValue,
      cost: oldCost,
      delta: -oldUnitValue,
      transaction: t,
      movementContext: {
        sourceType: "ItemPurchase",
        sourceId: existing.Id,
        operation: "DELETE",
        stockType: "ItemStock",
      },
    });

    if (!existing.productId) {
      await itemFifo.unwindInbound({
        transaction: t,
        itemId: existing.itemId,
        quantity: oldUnitValue,
      });
      await itemFifo.syncItemStockCost({
        transaction: t,
        itemId: existing.itemId,
      });
    }

    return Manufacture.destroy({
      where: { Id: id },
      transaction: t,
      movementContext: {
        sourceType: "ItemPurchase",
        sourceId: id,
        operation: "UPDATE_REVERSE",
        stockType: "ItemStock",
      },
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
    variant,
    variantKey,
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
      "variant",
      "variantKey",
      "supplierId",
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
  const nextItem = await Item.findOne({ where: { Id: nextItemId } });
  if (!nextItem) throw new ApiError(404, "Item not found");

  const nextProductId =
    productId === "" || productId == null ? existing.productId : productId;
  const nextVariant =
    variant === undefined
      ? parseVariantPayload(existing.variant)
      : parseVariantPayload(variant);
  const nextVariantKey =
    variantKey === undefined
      ? existing.variantKey
      : variantKey || buildVariantKey(nextVariant);
  const nextName = name === "" || name == null ? nextItem.name : name;
  const nextSupplierId =
    supplierId === "" || supplierId == null ? existing.supplierId : supplierId;

  const data = {
    itemId: nextItemId,
    productId: nextProductId,
    name: nextName,
    variant: nextVariant,
    variantKey: nextVariantKey,
    unit: normalizedPayload.unit,
    unitValue: totalUnitValue,
    cost: nextTotalCost,
    supplierId: nextSupplierId,
    // unitCost: totalUnitValue > 0 ? nextTotalCost / totalUnitValue : undefined,
    note: finalStatus === "Approved" ? null : newNote || null,
    status: finalStatus,
    date: String(date || "").slice(0, 10) || undefined,
  };

  const oldItemId = existing.itemId;
  const oldProductId = existing.productId || null;
  const oldVariantKey = existing.variantKey || null;
  const existingBasePayload = toBaseStockPayload(
    existing.unit,
    existing.unitValue,
  );
  const oldUnitValue = existingBasePayload.unitValue;
  const oldCost = toNumber(existing.cost);
  const oldVariant = parseVariantPayload(existing.variant);

  // Only a genuine item/product/variant change needs the full reverse (old
  // row) + reapply (new row) treatment — two different stock rows are
  // involved, and correctly rejecting it when the old row can't give back
  // its full original quantity (already sold/consumed elsewhere) is real.
  // When it's the same row, that same reverse-then-reapply would reject the
  // edit over stock already consumed even when the edit doesn't touch
  // quantity at all — apply the net change in one step instead.
  const isSameStockTarget =
    String(oldItemId) === String(nextItemId) &&
    String(oldProductId || "") === String(nextProductId || "") &&
    String(oldVariantKey || "") === String(nextVariantKey || "");

  const updatedCount = await db.sequelize.transaction(async (t) => {
    if (isSameStockTarget) {
      await adjustStockBalanceForSameTarget({
        Model: ItemMaster,
        stockLabel: "Item stock",
        itemId: nextItemId,
        productId: nextProductId,
        name: nextName,
        variant: nextVariant,
        variantKey: nextVariantKey,
        unit: normalizedPayload.unit,
        quantityDelta: totalUnitValue - oldUnitValue,
        costDelta: nextTotalCost - oldCost,
        transaction: t,
        movementContext: {
          sourceType: "ItemPurchase",
          sourceId: id,
          operation: "UPDATE_APPLY",
          stockType: "ItemStock",
        },
      });
    } else {
      await adjustStockBalance({
        Model: ItemMaster,
        stockLabel: "Item stock",
        itemId: oldItemId,
        productId: oldProductId,
        name: existing.name,
        variant: oldVariant,
        variantKey: oldVariantKey,
        unit: existingBasePayload.unit,
        unitValue: oldUnitValue,
        cost: oldCost,
        delta: -oldUnitValue,
        transaction: t,
      });

      await adjustStockBalance({
        Model: ItemMaster,
        stockLabel: "Item stock",
        itemId: nextItemId,
        productId: nextProductId,
        name: nextName,
        variant: nextVariant,
        variantKey: nextVariantKey,
        unit: normalizedPayload.unit,
        unitValue: totalUnitValue,
        cost: nextTotalCost,
        delta: totalUnitValue,
        transaction: t,
        createOnPositive: true,
        movementContext: {
          sourceType: "ItemPurchase",
          sourceId: id,
          operation: "UPDATE_APPLY",
          stockType: "ItemStock",
        },
      });
    }

    // FIFO: unwind the old purchase layer, open a fresh one for the edit.
    if (!oldProductId) {
      await itemFifo.unwindInbound({
        transaction: t,
        itemId: oldItemId,
        quantity: oldUnitValue,
      });
      await itemFifo.syncItemStockCost({ transaction: t, itemId: oldItemId });
    }
    if (!nextProductId) {
      await itemFifo.openLayer({
        transaction: t,
        itemId: nextItemId,
        unitCost:
          totalUnitValue > 0 ? toNumber(nextTotalCost) / totalUnitValue : 0,
        quantity: totalUnitValue,
        receivedDate:
          String(date || "").slice(0, 10) ||
          existing.date ||
          new Date().toISOString().slice(0, 10),
        sourceType: "ItemPurchase",
        sourceMovementId: id,
      });
      await itemFifo.syncItemStockCost({ transaction: t, itemId: nextItemId });
    }

    const [count] = await Manufacture.update(data, {
      where: { Id: id },
      transaction: t,
    });

    // Keep this purchase's linked due/paid ledger row in step with the
    // edit. Only touched while it's still Unpaid — once a supplier has
    // actually been paid against it, that row is a payment record, not a
    // reflection of the purchase's current cost, so a later edit here
    // shouldn't silently rewrite it. Deliberately NOT created here when
    // missing: a purchase from before this link existed already has its
    // original (orphaned, un-linked) SupplierHistory row from creation —
    // creating a second one on its first post-upgrade edit would double
    // that purchase's due instead of fixing it. Only purchases created
    // after this change (which always get linked at insert) benefit here;
    // older ones need a one-off manual reconciliation, not a silent auto-fix.
    if (nextSupplierId) {
      const existingHistory = await SupplierHistory.findOne({
        where: { manufactureId: id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (existingHistory && existingHistory.status === "Unpaid") {
        await existingHistory.update(
          {
            supplierId: nextSupplierId,
            amount: nextTotalCost,
            date: data.date || existingHistory.date,
          },
          { transaction: t },
        );
      }
    }

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

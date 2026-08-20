const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DamageRepairReturnSearchableFields } = require("./damageRepairReturn.constants");
const parseVariants = require("../../../shared/parseVariants");
const mergeVariants = require("../../../shared/mergeVariants");
const subtractVariantsPreserveZero = require("../../../shared/subtractVariantsPreserveZero");
const {
  getVariantQuantityTotal,
  hasVariantRows,
} = require("../../../shared/variantQuantity");

const DamageRepair = db.damageRepair;
const DamageReparingStock = db.damageReparingStock;
const Supplier = db.supplier;
const Warehouse = db.warehouse;

const findDamageReparingStockByProductId = async (productId, transaction) =>
  DamageReparingStock.findOne({
    where: { productId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

const findDamageReparingStockByReference = async (receivedId, transaction) => {
  const byId = await DamageReparingStock.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (byId) return byId;

  return DamageReparingStock.findOne({
    where: { productId: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
};

const insertIntoDB = async (data) => {
  const {
    quantity,
    receivedId,
    variants,
    date,
    note,
    status,
    supplierId,
    warehouseId,
    batchId,
  } = data;

  const returnQty = Number(quantity);
  const rid = Number(receivedId);
  const incomingVariants = parseVariants(variants);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const finalStatus = String(status || "").trim() || "Active";

  return await db.sequelize.transaction(async (t) => {
    const repairingStock = await findDamageReparingStockByReference(rid, t);
    if (!repairingStock) {
      throw new ApiError(404, "Damage repairing stock product not found");
    }

    const availableQty = hasVariantRows(repairingStock.variants)
      ? getVariantQuantityTotal(repairingStock.variants)
      : Number(repairingStock.quantity || 0);

    if (availableQty < returnQty) {
      throw new ApiError(400, `Not enough damage repairing stock. Available: ${availableQty}`);
    }

    const catalogProductId = Number(repairingStock.productId);

    const result = await DamageRepair.create(
      {
        name: repairingStock.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        variants: incomingVariants,
        source: "Damage Repairing Return",
        batchId: batchId || `batch-${Date.now()}`,
        purchase_price: Number(repairingStock.purchase_price || 0) * returnQty,
        sale_price: Number(repairingStock.sale_price || 0) * returnQty,
        productId: catalogProductId || repairingStock.Id,
        status: finalStatus || "---",
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
      },
      { transaction: t },
    );

    const nextVariants = incomingVariants.length
      ? subtractVariantsPreserveZero(repairingStock.variants, incomingVariants)
      : repairingStock.variants;
    const nextQty = hasVariantRows(nextVariants)
      ? getVariantQuantityTotal(nextVariants)
      : Math.max(0, availableQty - returnQty);

    await repairingStock.update(
      {
        quantity: nextQty,
        variants: nextVariants,
      },
      { transaction: t },
    );

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [{ source: "Damage Repairing Return" }];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DamageRepairReturnSearchableFields.map((field) => ({
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
    andConditions.push({ date: { [Op.between]: [start, end] } });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = { [Op.and]: andConditions };

  const result = await DamageRepair.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      { model: Supplier, as: "supplier", attributes: ["Id", "name"] },
      { model: Warehouse, as: "warehouse", attributes: ["Id", "name"] },
    ],
    paranoid: true,
    order: options.sortBy && options.sortOrder
      ? [[options.sortBy, options.sortOrder.toUpperCase()]]
      : [["createdAt", "DESC"]],
  });

  const [count, totalQuantity] = await Promise.all([
    DamageRepair.count({ where: whereConditions }),
    DamageRepair.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    const ret = await DamageRepair.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Damage Repairing Return product not found");

    const qty = Number(ret.quantity || 0);
    const itemVariants = parseVariants(ret.variants);

    const repairingStock = await findDamageReparingStockByProductId(Number(ret.productId), t);
    if (repairingStock) {
      const restoredVariants = mergeVariants(repairingStock.variants, itemVariants);
      const restoredQuantity = restoredVariants.length
        ? getVariantQuantityTotal(restoredVariants)
        : Number(repairingStock.quantity || 0) + qty;

      await repairingStock.update(
        {
          quantity: restoredQuantity,
          variants: restoredVariants,
        },
        { transaction: t },
      );
    }

    await DamageRepair.destroy({ where: { Id: id }, transaction: t });
    return { deleted: true };
  });
};

module.exports = {
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
};

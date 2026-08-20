const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DamageReturnSearchableFields } = require("./damageReturn.constants");
const parseVariants = require("../../../shared/parseVariants");
const mergeVariants = require("../../../shared/mergeVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const {
  getVariantQuantityTotal,
} = require("../../../shared/variantQuantity");

const DamageProduct = db.damageProduct;
const DamageStock = db.damageStock;
const Supplier = db.supplier;
const Warehouse = db.warehouse;

const findDamageStockByProductId = async (productId, transaction) =>
  DamageStock.findOne({
    where: { productId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

const findDamageStockByReference = async (receivedId, transaction) => {
  const byId = await DamageStock.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (byId) return byId;

  return DamageStock.findOne({
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
    const dStock = await findDamageStockByReference(rid, t);
    if (!dStock) throw new ApiError(404, "Damage stock product not found");

    const availableQty = Number(dStock.quantity || 0);
    if (availableQty < returnQty) {
      throw new ApiError(400, `Not enough damage stock. Available: ${availableQty}`);
    }

    const catalogProductId = Number(dStock.productId);

    const result = await DamageProduct.create(
      {
        name: dStock.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        variants: incomingVariants,
        source: "Damage Return",
        batchId: batchId || `batch-${Date.now()}`,
        purchase_price: Number(dStock.purchase_price || 0) * returnQty,
        sale_price: Number(dStock.sale_price || 0) * returnQty,
        productId: catalogProductId || dStock.Id,
        status: finalStatus || "---",
        note: finalStatus === "Approved" ? null : note || null,
        date: date,
      },
      { transaction: t },
    );

    const nextDamageVariants = incomingVariants.length
      ? subtractVariants(dStock.variants, incomingVariants)
      : dStock.variants;
    const nextDamageQty = incomingVariants.length
      ? getVariantQuantityTotal(nextDamageVariants)
      : Math.max(0, availableQty - returnQty);

    await dStock.update(
      {
        quantity: nextDamageQty,
        variants: nextDamageVariants,
      },
      { transaction: t },
    );

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [{ source: "Damage Return" }];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DamageReturnSearchableFields.map((field) => ({
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

  const result = await DamageProduct.findAll({
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
    DamageProduct.count({ where: whereConditions }),
    DamageProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    const ret = await DamageProduct.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Damage Return product not found");

    const qty = Number(ret.quantity || 0);
    const itemVariants = parseVariants(ret.variants);

    const dStock = await findDamageStockByProductId(Number(ret.productId), t);
    if (dStock) {
      const restoredVariants = mergeVariants(dStock.variants, itemVariants);
      const restoredQuantity = restoredVariants.length
        ? getVariantQuantityTotal(restoredVariants)
        : Number(dStock.quantity || 0) + qty;

      await dStock.update(
        {
          quantity: restoredQuantity,
          variants: restoredVariants,
        },
        { transaction: t },
      );
    }

    await DamageProduct.destroy({ where: { Id: id }, transaction: t });
    return { deleted: true };
  });
};

module.exports = {
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
};

const { Op, where, fn, col, literal } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const ConfirmOrder = db.confirmOrder;
const Product = db.product;

const getTrendingProductsFromDB = async (query) => {
  const days = Number(query?.days || 7);
  const limit = Number(query?.limit || 10);
  const sortBy = String(query?.sortBy || "soldQty"); // soldQty | revenue

  if (!Number.isFinite(days) || days <= 0) {
    throw new ApiError(400, "days must be a positive number");
  }

  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const result = await ConfirmOrder.findAll({
    attributes: [
      "productId",
      [fn("SUM", col("ConfirmOrder.quantity")), "soldQty"],
      [fn("SUM", col("ConfirmOrder.sale_price")), "revenue"],
    ],
    where: {
      date: { [Op.between]: [fromStr, toStr] },
      // status: { [Op.in]: ["Approved", "Active"] },
    },
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["Id", "name"],
        required: false,
      },
    ],
    group: ["ConfirmOrder.productId", "product.Id", "product.name"],
    order: [[literal(sortBy === "revenue" ? "revenue" : "soldQty"), "DESC"]],
    limit,
  });

  return {
    meta: {
      days,
      from: fromStr,
      to: toStr,
      limit,
      sortBy: sortBy === "revenue" ? "revenue" : "soldQty",
    },
    data: result,
  };
};

const ConfirmOrderService = {
  getTrendingProductsFromDB,
};

module.exports = ConfirmOrderService;

const { Op } = require("sequelize");
const db = require("../models");

// Total value of a product-keyed stock table (Damage Stock, Damage Repairing
// Stock) for the given filter: quantity × each product's Stock Product
// purchase_price — the same price the All Books stock totals use. A row's own
// purchase_price is a stale running total, so it's only the fallback for a
// product with no Stock Product row.
const getStockPurchaseValue = async (Model, where) => {
  const rows = await Model.findAll({
    where,
    attributes: ["productId", "quantity", "purchase_price", ...(Model.rawAttributes?.averageCost ? ["averageCost"] : [])],
    raw: true,
  });
  const productIds = [...new Set(rows.map((row) => row.productId).filter(Boolean))];
  const stockRows = productIds.length
    ? await db.inventoryMaster.findAll({
        where: { productId: { [Op.in]: productIds } },
        attributes: ["productId", "purchase_price"],
        raw: true,
      })
    : [];
  const priceByProductId = new Map(
    stockRows.map((row) => [Number(row.productId), Number(row.purchase_price || 0)]),
  );
  const total = rows.reduce((sum, row) => {
    const quantity = Number(row.quantity || 0);
    // Weighted-average costing: the row's own average once it has one.
    if (row.averageCost !== null && row.averageCost !== undefined) {
      return sum + quantity * Number(row.averageCost);
    }
    const price = priceByProductId.has(Number(row.productId))
      ? priceByProductId.get(Number(row.productId))
      : quantity > 0
        ? Number(row.purchase_price || 0) / quantity
        : 0;
    return sum + quantity * price;
  }, 0);
  return Math.round(total * 100) / 100;
};

module.exports = { getStockPurchaseValue };

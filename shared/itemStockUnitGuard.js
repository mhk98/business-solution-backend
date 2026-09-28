// Rejects an entry whose unit can't be counted in the item's Item Stock row —
// e.g. "Pcs" for Ajwa kept in Gram would silently be counted as grams
// (150 Pcs → 150 g at the full price). Empty or missing stock rows accept any
// unit (the row takes the new unit).
const db = require("../models");
const ApiError = require("../error/ApiError");
const {
  toBaseStockPayload,
  isCompatibleStockUnit,
} = require("../helpers/unitConversionHelper");

const ALLOWED_UNITS = {
  gram: "Gram / Kg",
  ml: "Ml / Liter",
};

// Same check against a given stock row (Item Stock or Factory Stock).
const assertUnitMatchesStockRow = (stockRow, unit, label = "Item Stock") => {
  if (!stockRow) return;
  const stock = toBaseStockPayload(stockRow.unit, stockRow.unitValue);
  if (stock.unitValue <= 0) return;
  if (isCompatibleStockUnit(stockRow.unit, unit || "Pcs")) return;

  const allowed = ALLOWED_UNITS[stock.unit.toLowerCase()] || stock.unit;
  throw new ApiError(
    400,
    `${stockRow.name} is kept in ${stock.unit} in ${label} — enter it in ${allowed}, not ${unit || "Pcs"}.`,
  );
};

const assertUnitMatchesItemStock = async ({ itemId, unit, transaction }) => {
  if (!itemId) return;
  const stockRow = await db.itemMaster.findOne({
    where: {
      itemId,
      [db.Sequelize.Op.or]: [{ productId: null }, { productId: 0 }],
    },
    order: [["createdAt", "ASC"]],
    transaction,
  });
  assertUnitMatchesStockRow(stockRow, unit);
};

module.exports = { assertUnitMatchesItemStock, assertUnitMatchesStockRow };

const ApiError = require("../error/ApiError");
const { toBaseStockPayload } = require("../helpers/unitConversionHelper");

// Calculate in base units and round only the final finished-product price.
// Both recipe lists reference ItemMaster IDs, including factory ingredients.
// Weighted-average costing: each ingredient is priced at the average cost of
// the pool it is actually drawn from — the manufacturer's Factory Stock row
// for mix items when the mixer has a manufacturer, else the Item Stock row.
const calculateMixerPurchasePrice = async ({
  mixItems = [], packagingItems = [], combo, unitWage = 0, othersCost = 0,
  manufacturerId = null, transaction, db: suppliedDb, unitCostOf: suppliedResolver,
}) => {
  const db = suppliedDb || require("../models");
  const unitCostOf = suppliedResolver || ((itemId, average) => average);
  const averageOf = (stock) => {
    const quantity = toBaseStockPayload(stock.unit, stock.unitValue).unitValue;
    return quantity > 0 ? Number(stock.cost || 0) / quantity : null;
  };
  if (!(Number(combo) > 0)) throw new ApiError(400, "Combo quantity must be greater than 0");
  let total = Number(othersCost || 0);
  for (const [rows, idKey] of [[mixItems, "manufactureId"], [packagingItems, "itemMasterId"]]) {
    for (const row of rows || []) {
      const quantity = toBaseStockPayload(row.unit || "Pcs", row.unitValue).unitValue;
      if (!(quantity > 0)) continue;
      const item = await db.itemMaster.findOne({ where: { Id: Number(row[idKey]) }, transaction });
      if (!item) throw new ApiError(400, `Item Stock ${row[idKey]} not found for Mixer costing`);
      const stockUnit = toBaseStockPayload(item.unit, item.unitValue);
      const recipeUnit = toBaseStockPayload(row.unit || "Pcs", row.unitValue);
      if (String(stockUnit.unit).toLowerCase() !== String(recipeUnit.unit).toLowerCase()) {
        throw new ApiError(400, `Unit mismatch for Item Stock ${row[idKey]}: recipe ${row.unit || "Pcs"}, stock ${item.unit}`);
      }
      let average = averageOf(item) ?? 0;
      if (idKey === "manufactureId" && manufacturerId && db.manufactureStock) {
        const factoryStock = await db.manufactureStock.findOne({
          where: { itemId: item.itemId, manufacturerId: Number(manufacturerId) },
          transaction,
        });
        if (factoryStock && averageOf(factoryStock) != null) average = averageOf(factoryStock);
      }
      total += quantity * unitCostOf(item.itemId, average);
    }
  }
  return Math.round((total / Number(combo) + Number(unitWage || 0)) * 100) / 100;
};

module.exports = { calculateMixerPurchasePrice };

// Latest non-deleted Item Purchase cost per base unit. Purchase date determines
// recency; Id breaks ties. A zero-price purchase is a valid latest price.
//
// `db` is required lazily (inside the function, not at module load) because
// this module is required both from service files (safe, models already
// fully loaded by then) AND from models/index.js itself while it's still
// mid-load — a top-level `require("../models")` there would capture models/
// index.js's exports before `module.exports = db` runs, permanently binding
// to an empty object and breaking every model lookup for the life of the
// process (module requires are cached and only evaluated once).
const { Op } = require("sequelize");
const { toBaseStockPayload } = require("../helpers/unitConversionHelper");

const round4 = (value) => Math.round((Number(value) || 0) * 10000) / 10000;
const baseOf = (unit, value) => toBaseStockPayload(unit, value).unitValue;

const buildItemUnitCostResolver = async ({ transaction, db: suppliedDb } = {}) => {
  const db = suppliedDb || require("../models");
  const purchases = await db.manufacture.findAll({
    attributes: ["itemId", "unit", "unitValue", "cost"],
    order: [["date", "DESC"], ["Id", "DESC"]],
    paranoid: true,
    transaction,
    raw: true,
  });
  const latest = new Map();
  for (const p of purchases) {
    const base = baseOf(p.unit, p.unitValue);
    const id = Number(p.itemId);
    if (!id || base <= 0 || latest.has(id)) continue;
    latest.set(id, Number(p.cost || 0) / base);
  }

  const flatStocks = await db.itemMaster.findAll({
    where: {
      itemId: { [Op.ne]: null },
      [Op.or]: [{ productId: null }, { productId: 0 }],
    },
    raw: true,
    transaction,
  });
  const flatUc = {};
  for (const s of flatStocks) {
    const base = baseOf(s.unit, s.unitValue);
    if (base > 0 && Number(s.cost) > 0) flatUc[s.itemId] = Number(s.cost) / base;
  }

  return (itemId, fallback = 0) => {
    if (latest.has(Number(itemId))) return latest.get(Number(itemId));
    if (flatUc[itemId] > 0) return round4(flatUc[itemId]);
    return round4(fallback);
  };
};

module.exports = { buildItemUnitCostResolver, baseOf, round4 };

// Per-manufacture-item base-unit cost resolver: weighted-average of that
// item's purchases (`manufacture` = Item Purchase), falling back to the flat
// Item Stock row's current unit cost. Used to backfill/display a "last known"
// unit cost for Factory Stock rows whose own running cost has gone to 0
// (e.g. quantity fully consumed) without a per-lot FIFO layer to fall back on.
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

const buildItemUnitCostResolver = async () => {
  const db = require("../models");
  const purchases = await db.manufacture.findAll({
    attributes: ["itemId", "unit", "unitValue", "cost"],
    paranoid: false,
    raw: true,
  });
  const agg = {};
  for (const p of purchases) {
    const base = baseOf(p.unit, p.unitValue);
    if (base <= 0) continue;
    agg[p.itemId] ||= { qty: 0, value: 0 };
    agg[p.itemId].qty += base;
    agg[p.itemId].value += Number(p.cost) || 0;
  }

  const flatStocks = await db.itemMaster.findAll({
    where: {
      itemId: { [Op.ne]: null },
      [Op.or]: [{ productId: null }, { productId: 0 }],
    },
    raw: true,
  });
  const flatUc = {};
  for (const s of flatStocks) {
    const base = baseOf(s.unit, s.unitValue);
    if (base > 0 && Number(s.cost) > 0) flatUc[s.itemId] = Number(s.cost) / base;
  }

  return (itemId, fallback = 0) => {
    const a = agg[itemId];
    if (a && a.qty > 0) return round4(a.value / a.qty);
    if (flatUc[itemId] > 0) return round4(flatUc[itemId]);
    return round4(fallback);
  };
};

module.exports = { buildItemUnitCostResolver, baseOf, round4 };

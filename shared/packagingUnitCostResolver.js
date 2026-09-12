// Per-packaging-item base-unit cost resolver: weighted-average of that item's
// purchases (`packagingItemPurchase`), falling back to the flat Packaging Item
// Stock row's current unit cost. Mirrors shared/itemUnitCostResolver.js — used
// to show a "last known" unit cost for Packaging Factory Stock rows whose own
// running cost has gone to 0 (e.g. quantity fully consumed), since that stock
// is a running weighted-average balance rather than per-lot FIFO layers.
//
// `db` is required lazily (inside the function) — see the note in
// shared/itemUnitCostResolver.js for why a top-level require here would be
// unsafe if this module is ever pulled in from models/index.js mid-load.
const { toBaseStockPayload } = require("../helpers/unitConversionHelper");

const round4 = (value) => Math.round((Number(value) || 0) * 10000) / 10000;
const baseOf = (unit, value) => toBaseStockPayload(unit, value).unitValue;

const buildPackagingUnitCostResolver = async () => {
  const db = require("../models");
  const purchases = await db.packagingItemPurchase.findAll({
    attributes: ["packagingItemId", "unit", "unitValue", "cost"],
    paranoid: false,
    raw: true,
  });
  const agg = {};
  for (const p of purchases) {
    const base = baseOf(p.unit, p.unitValue);
    if (base <= 0) continue;
    agg[p.packagingItemId] ||= { qty: 0, value: 0 };
    agg[p.packagingItemId].qty += base;
    agg[p.packagingItemId].value += Number(p.cost) || 0;
  }

  const flatStocks = await db.packagingItemStock.findAll({ raw: true });
  const flatUc = {};
  for (const s of flatStocks) {
    const base = baseOf(s.unit, s.unitValue);
    if (base > 0 && Number(s.cost) > 0) {
      flatUc[s.packagingItemId] = Number(s.cost) / base;
    }
  }

  return (packagingItemId, fallback = 0) => {
    const a = agg[packagingItemId];
    if (a && a.qty > 0) return round4(a.value / a.qty);
    if (flatUc[packagingItemId] > 0) return round4(flatUc[packagingItemId]);
    return round4(fallback);
  };
};

module.exports = { buildPackagingUnitCostResolver };

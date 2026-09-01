const parseVariants = require("./parseVariants");

const n = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

// Phase 0 helper — best-effort per-unit price for stamping onto a stock_movement
// row. The source rows are inconsistent: some columns hold a per-unit price,
// some hold a pre-computed line total (qty x price). The caller passes `mode`
// to say which it has.
//
//   mode "unit"  -> value is already per-unit, returned as-is
//   mode "total" -> value is a line total, divided by quantity
const toUnitPrice = (storedValue, quantity, mode = "total") => {
  const value = n(storedValue);
  if (mode === "unit") return value;
  const qty = n(quantity);
  return qty > 0 ? value / qty : 0;
};

// Quantity-weighted average unit price across a variant array:
//   sum(v.quantity * v[field]) / sum(v.quantity)
// Returns 0 when there are no priced variant lines.
const variantUnitPrice = (variants, field) => {
  let totalValue = 0;
  let totalQty = 0;

  parseVariants(variants).forEach((variant) => {
    const qty = n(variant?.quantity);
    totalValue += qty * n(variant?.[field]);
    totalQty += qty;
  });

  return totalQty > 0 ? totalValue / totalQty : 0;
};

// Resolve the per-unit price for one movement item/row.
// - If the variant lines carry prices, use their weighted average.
// - Otherwise fall back to the row-level `field`, interpreted per `mode`.
const resolveUnitPrice = (row = {}, field, { mode = "total" } = {}) => {
  const fromVariants = variantUnitPrice(row.variants, field);
  if (fromVariants > 0) return fromVariants;
  return toUnitPrice(row[field], row.quantity, mode);
};

module.exports = { toUnitPrice, variantUnitPrice, resolveUnitPrice };

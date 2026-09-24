// Perpetual weighted-average costing for all 7 stock pools (replaces FIFO
// cost layers — see memory/weighted-average-costing).
//
//   inbound  → avg' = (q·avg + inQty·inCost) / (q + inQty)
//   outbound → costed at the current avg; avg unchanged
//   transfer → leaves the source at its avg, enters the target at that cost
//
// Where each pool keeps its average:
//   ProductStock            averageCost (exact) + purchase_price (rounded, integer column)
//   DamageStock/Repairing   averageCost (exact) + purchase_price (= rounded total value)
//   Item/Factory/Packaging  cost (= total value) ÷ unitValue
const { POOLS, stockQuantity } = require("./stockReportBalances");

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const round4 = (value) => Math.round(Number(value || 0) * 10000) / 10000;
const plain = (row) => (row?.toJSON ? row.toJSON() : row || {});

const isProductPool = (stockType) => POOLS[stockType]?.id === "productId";

// Current weighted-average unit cost of a stock row.
const currentAverage = (stockType, row) => {
  const data = plain(row);
  const quantity = stockQuantity(data, POOLS[stockType]);
  if (data.averageCost !== undefined && data.averageCost !== null) {
    return Number(data.averageCost);
  }
  if (stockType === "ProductStock") return Number(data.purchase_price || 0);
  if (isProductPool(stockType)) {
    return quantity > 0 ? Number(data.purchase_price || 0) / quantity : 0;
  }
  return quantity > 0 ? Number(data.cost || 0) / quantity : 0;
};

// New average after `inQty` units arrive at `inCost` each. Stock that was
// empty (or negative) takes the incoming cost outright.
const blendAverage = ({ quantityBefore, averageBefore, inQuantity, inCost }) => {
  const before = Math.max(Number(quantityBefore || 0), 0);
  const incoming = Number(inQuantity || 0);
  if (incoming <= 0) return round4(averageBefore);
  if (before <= 0) return round4(inCost);
  return round4((before * Number(averageBefore || 0) + incoming * Number(inCost || 0)) / (before + incoming));
};

// Fields to write on the stock row so it carries `average` at `quantityAfter`.
const averageFields = (stockType, { average, quantityAfter }) => {
  const avg = round4(average);
  if (stockType === "ProductStock") {
    return { averageCost: avg, purchase_price: Math.round(avg) };
  }
  if (isProductPool(stockType)) {
    return { averageCost: avg, purchase_price: Math.round(avg * Math.max(quantityAfter, 0)) };
  }
  return { cost: round2(avg * Math.max(quantityAfter, 0)) };
};

// Inbound: returns the blended average, the fields to save and the movement
// cost columns (unitCost = incoming cost, averageCostAfter = new average).
const inbound = (stockType, row, { quantity, unitCost }) => {
  const quantityBefore = stockQuantity(plain(row), POOLS[stockType]);
  const average = blendAverage({
    quantityBefore,
    averageBefore: currentAverage(stockType, row),
    inQuantity: quantity,
    inCost: unitCost,
  });
  const quantityAfter = quantityBefore + Number(quantity || 0);
  return {
    average,
    fields: averageFields(stockType, { average, quantityAfter }),
    movement: { unitCost: round4(unitCost), averageCostAfter: average },
  };
};

// Outbound: costed at the current average, which stays the same; only the
// total-value columns shrink with the quantity.
const outbound = (stockType, row, { quantity }) => {
  const quantityBefore = stockQuantity(plain(row), POOLS[stockType]);
  const average = round4(currentAverage(stockType, row));
  const quantityAfter = quantityBefore - Number(quantity || 0);
  return {
    average,
    totalCost: round2(average * Number(quantity || 0)),
    fields: averageFields(stockType, { average, quantityAfter }),
    movement: { unitCostConsumed: average, averageCostAfter: average },
  };
};

// Admin price edit: same quantity, new average (logged as a REVALUATION).
const revalue = (stockType, row, { average }) => {
  const quantity = stockQuantity(plain(row), POOLS[stockType]);
  return {
    average: round4(average),
    fields: averageFields(stockType, { average, quantityAfter: quantity }),
    movement: { averageCostAfter: round4(average) },
  };
};

module.exports = { currentAverage, blendAverage, averageFields, inbound, outbound, revalue };

// FIFO cost-layer engine (Phase 1).
//
// Layers are keyed by productId only — product-level FIFO. Variant-level cost
// splitting is a later phase; the `variantKey` column exists but stays null for
// now, so a variant product's layers hold its blended cost.
//
// Every function runs inside the caller's DB transaction and locks the rows it
// touches (SELECT ... FOR UPDATE) so concurrent movements can't double-spend a
// layer.
const db = require("../models");
const ApiError = require("../error/ApiError");

const { Op } = db.Sequelize;
const CostLayer = () => db.inventoryCostLayer;

// A costed movement older than this many days is "closed" — its parent record
// can't be edited or deleted (that would need a FIFO replay). Users post a
// compensating adjustment instead.
const CLOSED_PERIOD_DAYS = 90;

const n = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

// costBreakdown may come back from the DB already parsed or as a JSON string.
const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};
const round2 = (value) => Math.round(n(value) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const parseVariants = require("./parseVariants");

// "size__color" — matches mergeVariants/subtractVariants/reconciler.
const variantKeyOf = (variant = {}) =>
  `${String(variant.size || "").trim()}__${String(variant.color || "").trim()}`;

const variantLines = (variants) =>
  parseVariants(variants).filter((v) => v && n(v.quantity) > 0);

// Add a variantKey filter only when the caller specified one (null included —
// that targets the flat/product-level pool). `undefined` matches every layer
// for the product.
const withVariantKey = (where, variantKey) => {
  if (variantKey === undefined) return where;
  return { ...where, variantKey: variantKey === null ? null : String(variantKey) };
};

// Open a new inbound cost layer. Returns the created row (or null when there is
// nothing to record).
const openLayer = async ({
  transaction,
  productId,
  variantKey = null,
  unitCost,
  quantity,
  receivedDate,
  sourceType,
  sourceMovementId = null,
  note = null,
}) => {
  const qty = round2(quantity);
  if (!Number(productId) || qty <= 0) return null;

  return CostLayer().create(
    {
      productId: Number(productId),
      variantKey: variantKey === null ? null : String(variantKey),
      sourceType: sourceType || "Unknown",
      sourceMovementId: sourceMovementId || null,
      receivedDate: receivedDate || today(),
      originalQty: qty,
      remainingQty: qty,
      unitCost: round2(unitCost),
      note,
    },
    { transaction },
  );
};

// Weighted-average unit cost of a product's still-open layers. Falls back to
// `fallback` when the product has no open layers.
const currentAverageCost = async ({ transaction, productId, fallback = 0 }) => {
  const layers = await CostLayer().findAll({
    where: { productId: Number(productId), remainingQty: { [Op.gt]: 0 } },
    transaction,
  });
  let qty = 0;
  let value = 0;
  layers.forEach((layer) => {
    qty += n(layer.remainingQty);
    value += n(layer.remainingQty) * n(layer.unitCost);
  });
  return qty > 0 ? round2(value / qty) : round2(fallback);
};

// Batched sibling of currentAverageCost: true weighted-average cost of each
// product's still-open layers — i.e. what's actually left in stock right now,
// blended across whichever lots make it up (not just "last purchase price").
// Products with no open layers are omitted (caller decides the fallback).
const currentAverageCostMap = async (productIds) => {
  const ids = [
    ...new Set(
      (productIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (!ids.length) return new Map();

  const rows = await CostLayer().findAll({
    attributes: [
      "productId",
      [
        db.Sequelize.fn("SUM", db.Sequelize.literal("remainingQty * unitCost")),
        "value",
      ],
      [db.Sequelize.fn("SUM", db.Sequelize.col("remainingQty")), "qty"],
    ],
    where: { productId: { [Op.in]: ids }, remainingQty: { [Op.gt]: 0 } },
    group: ["productId"],
    raw: true,
  });

  const map = new Map();
  for (const row of rows) {
    const qty = n(row.qty);
    if (qty > 0) {
      map.set(Number(row.productId), round2(n(row.value) / qty));
    }
  }
  return map;
};

// Last known unit cost per product, from layers regardless of remainingQty
// (layers are never deleted, only drawn down) — unlike currentAverageCost,
// this still resolves a price after a product's stock is fully depleted, for
// display/reporting purposes where a stale-but-real reference price beats 0.
const lastKnownUnitCostMap = async (productIds) => {
  const ids = [
    ...new Set(
      (productIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (!ids.length) return new Map();

  const layers = await CostLayer().findAll({
    where: { productId: { [Op.in]: ids } },
    order: [
      ["receivedDate", "DESC"],
      ["Id", "DESC"],
    ],
    raw: true,
  });

  const map = new Map();
  for (const layer of layers) {
    if (!map.has(layer.productId)) {
      map.set(layer.productId, n(layer.unitCost));
    }
  }
  return map;
};

// Consume `quantity` units FIFO (oldest receivedDate first).
// Returns { unitCostConsumed, totalCost, costBreakdown, shortfallQty }.
// On shortfall (no layers left) the remainder is drawn at `fallbackUnitCost`
// and flagged `estimated` in the breakdown.
const consumeFifo = async ({
  transaction,
  productId,
  variantKey,
  quantity,
  fallbackUnitCost = 0,
}) => {
  const need = round2(quantity);
  const result = {
    unitCostConsumed: 0,
    totalCost: 0,
    costBreakdown: [],
    shortfallQty: 0,
  };
  if (!Number(productId) || need <= 0) return result;

  const layers = await CostLayer().findAll({
    where: withVariantKey(
      { productId: Number(productId), remainingQty: { [Op.gt]: 0 } },
      variantKey,
    ),
    order: [
      ["receivedDate", "ASC"],
      ["Id", "ASC"],
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let remaining = need;
  let totalCost = 0;

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, n(layer.remainingQty));
    if (take <= 0) continue;
    const unitCost = n(layer.unitCost);
    totalCost += take * unitCost;
    result.costBreakdown.push({
      layerId: layer.Id,
      qty: round2(take),
      unitCost: round2(unitCost),
    });
    await layer.update(
      { remainingQty: round2(n(layer.remainingQty) - take) },
      { transaction },
    );
    remaining = round2(remaining - take);
  }

  if (remaining > 0) {
    const unitCost = round2(fallbackUnitCost);
    totalCost += remaining * unitCost;
    result.shortfallQty = remaining;
    result.costBreakdown.push({
      layerId: null,
      qty: remaining,
      unitCost,
      estimated: true,
    });
  }

  result.totalCost = round2(totalCost);
  result.unitCostConsumed = need > 0 ? round2(totalCost / need) : 0;
  return result;
};

// Reverse a consumption by adding each named quantity back onto its layer.
// Synthetic (estimated) entries with layerId null are skipped — the caller
// should open a compensating layer for those.
const restoreToLayers = async ({ transaction, costBreakdown }) => {
  const entries = asArray(costBreakdown);
  let restoredQty = 0;
  for (const entry of entries) {
    if (!entry || !entry.layerId) continue;
    const layer = await CostLayer().findByPk(entry.layerId, {
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!layer) continue;
    const next = Math.min(
      n(layer.originalQty),
      round2(n(layer.remainingQty) + n(entry.qty)),
    );
    restoredQty += next - n(layer.remainingQty);
    await layer.update({ remainingQty: next }, { transaction });
  }
  return { restoredQty: round2(restoredQty) };
};

// Look up the CREATE movement a source row produced, to recover its recorded
// cost data when reversing.
const findCreateMovement = async ({ transaction, sourceType, sourceId }) => {
  if (!db.stockMovement || !sourceType || !sourceId) return null;
  return db.stockMovement.findOne({
    where: { sourceType, sourceId: Number(sourceId), operation: "CREATE" },
    order: [["Id", "DESC"]],
    transaction,
  });
};

// Put `quantity` units back into stock (dispatch reversed/deleted, POS restore).
// Prefers restoring the exact layers the original sale drew from; otherwise
// opens a fresh layer at a resolved cost.
const restoreStock = async ({
  transaction,
  productId,
  quantity,
  receivedDate,
  sourceType,
  sourceId = null,
  sourceMovementId = null,
  fallbackUnitCost = 0,
}) => {
  const original = sourceId
    ? await findCreateMovement({ transaction, sourceType, sourceId })
    : null;
  const breakdown = asArray(original && original.costBreakdown);

  if (breakdown.some((e) => e && e.layerId)) {
    const { restoredQty } = await restoreToLayers({
      transaction,
      costBreakdown: breakdown,
    });
    const shortfall = round2(round2(quantity) - restoredQty);
    if (shortfall > 0.0) {
      await openLayer({
        transaction,
        productId,
        quantity: shortfall,
        unitCost: original ? n(original.unitCostConsumed) : 0,
        receivedDate,
        sourceType,
        sourceMovementId,
        note: "restore (partial)",
      });
    }
    return { mode: "restored" };
  }

  // No exact layer to restore to, and no invented cost — use the cost the
  // original movement recorded, else 0 ("cost not recorded").
  const unitCost = original ? n(original.unitCostConsumed) : 0;
  const layer = await openLayer({
    transaction,
    productId,
    quantity,
    unitCost,
    receivedDate,
    sourceType,
    sourceMovementId,
    note: "restore",
  });
  return { mode: "new-layer", layerId: layer ? layer.Id : null, unitCost };
};

// Sales return: the returned units re-enter stock at the cost they left at.
// Per-variant when the return has variant lines; the return form rarely carries
// a per-variant cost, so those layers open at `unitCost` (row-level) or 0.
const returnToStock = async ({
  transaction,
  productId,
  quantity,
  unitCost,
  variants,
  receivedDate,
  sourceMovementId = null,
}) => {
  const lines = variantLines(variants);
  if (!lines.length) {
    return openLayer({
      transaction,
      productId,
      variantKey: null,
      quantity,
      unitCost,
      receivedDate,
      sourceType: "ReturnProduct",
      sourceMovementId,
      note: "sales return",
    });
  }
  // `v.purchase_price`, when present, is unreliable — some callers send it as
  // a per-line total (qty × unit price) rather than per-unit, and there's no
  // way to tell which from here. The return form's own contract never sends
  // a per-variant price at all (only size/color/quantity), so the outer
  // `unitCost` — already resolved to a true per-unit price by the caller —
  // is the only value applied uniformly across every variant line.
  for (const v of lines) {
    await openLayer({
      transaction,
      productId,
      variantKey: variantKeyOf(v),
      quantity: n(v.quantity),
      unitCost: n(unitCost),
      receivedDate,
      sourceType: "ReturnProduct",
      sourceMovementId,
      note: "sales return",
    });
  }
  return null;
};

// Remove `quantity` from a product's layers (a purchase reversed). Takes from
// the newest layers first (LIFO) since a reversal usually unwinds a recent
// receipt.
const unwindInbound = async ({ transaction, productId, variantKey, quantity }) => {
  const need = round2(quantity);
  if (!Number(productId) || need <= 0) return { removedQty: 0 };

  const layers = await CostLayer().findAll({
    where: withVariantKey(
      { productId: Number(productId), remainingQty: { [Op.gt]: 0 } },
      variantKey,
    ),
    order: [
      ["receivedDate", "DESC"],
      ["Id", "DESC"],
    ],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let remaining = need;
  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, n(layer.remainingQty));
    await layer.update(
      { remainingQty: round2(n(layer.remainingQty) - take) },
      { transaction },
    );
    remaining = round2(remaining - take);
  }
  return { removedQty: round2(need - remaining) };
};

// ---- variant-aware wrappers ----------------------------------------------
// A movement line for a variant product carries per-variant quantities. These
// split the FIFO work across each variant's own layer pool; a movement with no
// variant lines falls through to the flat product-level pool.

const consumeForRow = async ({ transaction, productId, quantity, variants }) => {
  const lines = variantLines(variants);
  if (!lines.length) {
    return consumeFifo({ transaction, productId, variantKey: null, quantity });
  }

  const out = { unitCostConsumed: 0, totalCost: 0, costBreakdown: [], shortfallQty: 0 };
  let qty = 0;
  for (const v of lines) {
    const key = variantKeyOf(v);
    const r = await consumeFifo({
      transaction,
      productId,
      variantKey: key,
      quantity: n(v.quantity),
    });
    out.totalCost += r.totalCost;
    out.shortfallQty += r.shortfallQty;
    r.costBreakdown.forEach((b) => out.costBreakdown.push({ ...b, variantKey: key }));
    qty += n(v.quantity);
  }
  out.totalCost = round2(out.totalCost);
  out.unitCostConsumed = qty > 0 ? round2(out.totalCost / qty) : 0;
  return out;
};

// Open inbound layer(s) for a receipt. Per-variant `purchase_price` wins; a 0
// stays 0 (no fallback — the user fills it in later).
const openForRow = async ({
  transaction,
  productId,
  quantity,
  unitCost,
  variants,
  receivedDate,
  sourceType,
  sourceMovementId = null,
}) => {
  const lines = variantLines(variants);
  if (!lines.length) {
    return openLayer({
      transaction,
      productId,
      variantKey: null,
      quantity,
      unitCost,
      receivedDate,
      sourceType,
      sourceMovementId,
    });
  }
  for (const v of lines) {
    await openLayer({
      transaction,
      productId,
      variantKey: variantKeyOf(v),
      quantity: n(v.quantity),
      unitCost: n(v.purchase_price),
      receivedDate,
      sourceType,
      sourceMovementId,
    });
  }
  return null;
};

const unwindForRow = async ({ transaction, productId, quantity, variants }) => {
  const lines = variantLines(variants);
  if (!lines.length) {
    return unwindInbound({ transaction, productId, variantKey: null, quantity });
  }
  for (const v of lines) {
    await unwindInbound({
      transaction,
      productId,
      variantKey: variantKeyOf(v),
      quantity: n(v.quantity),
    });
  }
  return { removedQty: round2(quantity) };
};

// Block edits/deletes to a source record whose CREATE movement is older than
// the closed period. No-op when nothing costed exists yet for the source.
const assertNotClosedPeriod = async ({
  transaction,
  sourceType,
  sourceId,
  days = CLOSED_PERIOD_DAYS,
}) => {
  if (!db.stockMovement || !sourceType || !sourceId) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const stale = await db.stockMovement.findOne({
    where: {
      sourceType,
      sourceId: Number(sourceId),
      operation: "CREATE",
      date: { [Op.ne]: null, [Op.lt]: cutoffStr },
    },
    transaction,
  });

  if (stale) {
    throw new ApiError(
      400,
      `This entry is more than ${days} days old and already costed — it can no longer be edited or deleted. Post a stock adjustment instead.`,
    );
  }
};

module.exports = {
  openLayer,
  consumeFifo,
  consumeForRow,
  openForRow,
  unwindForRow,
  restoreToLayers,
  restoreStock,
  returnToStock,
  unwindInbound,
  currentAverageCost,
  currentAverageCostMap,
  lastKnownUnitCostMap,
  findCreateMovement,
  assertNotClosedPeriod,
  variantKeyOf,
  CLOSED_PERIOD_DAYS,
};

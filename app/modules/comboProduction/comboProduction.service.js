const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const MixerService = require("../mixer/mixer.service");

// Combo Production re-runs an existing Mixer recipe: the user picks a combo
// (a product already made on the Mixer screen), a warehouse and a quantity.
// The latest Mixer entry for that product is the template — its recipe is
// scaled per combo and saved as a regular Mixer row tagged
// `combo_production`, so Item Stock / Factory Stock / Stock Product, the
// received-product row, stock movements and costing all follow the exact
// same path as a Mixer entry. No wage or other cost is charged.

const Mixer = db.mixer;
const ItemMaster = db.itemMaster;
const InventoryMaster = db.inventoryMaster;
const Warehouse = db.warehouse;

const {
  MIXER_ENTRY_TYPE,
  COMBO_PRODUCTION_ENTRY_TYPE,
  parseMixerNote,
} = MixerService;

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const roundQuantity = (value) => Math.round(value * 10000) / 10000;

const perComboRows = (rows, idKey, combo) =>
  (rows || []).map((row) => ({
    [idKey]: Number(row[idKey]),
    unit: row.unit || "Pcs",
    perCombo: roundQuantity(toNumber(row.unitValue) / combo),
  }));

const scaleRows = (rows, idKey, combo, quantity) =>
  (rows || []).map((row) => {
    const unitValue = roundQuantity((toNumber(row.unitValue) / combo) * quantity);
    return {
      [idKey]: Number(row[idKey]),
      unitValue,
      value: unitValue,
      quantity: 1,
      unit: row.unit || "Pcs",
    };
  });

// Latest Mixer entry (not a Combo Production run) per product, keyed by
// productId. Variant outputs are skipped — a single quantity can't say how
// many of each size/color to make.
const loadTemplates = async () => {
  const rows = await Mixer.findAll({
    where: { entryType: MIXER_ENTRY_TYPE },
    order: [["Id", "DESC"]],
    paranoid: true,
  });

  const templates = new Map();
  for (const row of rows) {
    const productId = Number(row.productId || 0);
    if (!productId || templates.has(productId)) continue;

    const combo = toNumber(row.combo);
    const meta = parseMixerNote(row.note);
    const hasRecipe = meta.mixItems.length || meta.packagingItems.length;
    if (combo <= 0 || !hasRecipe || (meta.variants || []).length) continue;

    templates.set(productId, { row, meta, combo });
  }

  return templates;
};

const getCombos = async () => {
  const templates = [...(await loadTemplates()).values()];

  const itemIds = new Set();
  for (const { meta } of templates) {
    meta.mixItems.forEach((item) => itemIds.add(Number(item.manufactureId)));
    meta.packagingItems.forEach((item) => itemIds.add(Number(item.itemMasterId)));
  }
  const items = itemIds.size
    ? await ItemMaster.findAll({
        where: { Id: [...itemIds] },
        attributes: ["Id", "name"],
        paranoid: false,
      })
    : [];
  const itemNames = new Map(items.map((item) => [Number(item.Id), item.name]));
  const withName = (row, idKey) => ({
    ...row,
    name: itemNames.get(row[idKey]) || `Item #${row[idKey]}`,
  });

  return templates
    .map(({ row, meta, combo }) => ({
      templateMixerId: row.Id,
      productId: Number(row.productId),
      name: row.name,
      manufacturerId: meta.manufacturerId || row.manufacturerId || null,
      manufacturerName: meta.manufacturerName || row.manufacturerName || null,
      warehouseId: meta.warehouseId || null,
      lastMixedOn: row.date,
      mixItems: perComboRows(meta.mixItems, "manufactureId", combo).map((item) =>
        withName(item, "manufactureId"),
      ),
      packagingItems: perComboRows(
        meta.packagingItems,
        "itemMasterId",
        combo,
      ).map((item) => withName(item, "itemMasterId")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const insertIntoDB = async (payload = {}) => {
  const productId = Number(payload.productId || 0);
  const quantity = toNumber(payload.quantity);
  const warehouseId = Number(payload.warehouseId || 0);

  if (!productId) throw new ApiError(400, "Combo is required");
  if (!warehouseId) throw new ApiError(400, "Warehouse is required");
  if (!(quantity > 0)) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const template = (await loadTemplates()).get(productId);
  if (!template) {
    throw new ApiError(
      404,
      "No Mixer recipe found for this combo — make it once from Mixer first",
    );
  }

  const warehouse = await Warehouse.findOne({ where: { Id: warehouseId } });
  if (!warehouse) throw new ApiError(404, "Warehouse not found");

  const { row, meta, combo } = template;
  const inventory = await InventoryMaster.findOne({
    where: { productId },
    attributes: ["sale_price"],
  });
  // Keep the product's current sale price — Mixer writes this onto Stock
  // Product, and Combo Production shouldn't change it.
  const salePrice = toNumber(inventory?.sale_price) || toNumber(meta.sale_price);

  return MixerService.insertIntoDB(
    {
      productId,
      manufacturerId: meta.manufacturerId || row.manufacturerId || null,
      warehouseId,
      mixItems: scaleRows(meta.mixItems, "manufactureId", combo, quantity),
      packagingItems: scaleRows(
        meta.packagingItems,
        "itemMasterId",
        combo,
        quantity,
      ),
      date: payload.date || new Date().toISOString().slice(0, 10),
      note: String(payload.note || "").trim() || "Combo Production",
      combo: quantity,
      variants: [],
      purchase_price_custom: false,
      sale_price: salePrice,
      unitWage: 0,
      othersCost: 0,
    },
    {
      entryType: COMBO_PRODUCTION_ENTRY_TYPE,
      templateMixerId: row.Id,
    },
  );
};

const getAllFromDB = (filters, options) =>
  MixerService.getAllFromDB(filters, options, {
    entryType: COMBO_PRODUCTION_ENTRY_TYPE,
  });

const deleteIdFromDB = async (id) => {
  const existing = await Mixer.findOne({
    where: { Id: id, entryType: COMBO_PRODUCTION_ENTRY_TYPE },
    attributes: ["Id"],
  });
  if (!existing) throw new ApiError(404, "Combo Production entry not found");

  return MixerService.deleteIdFromDB(id);
};

module.exports = {
  getCombos,
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
};

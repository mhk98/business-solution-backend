const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  getInventoryDisplayQuantity,
} = require("../../../shared/variantQuantity");
const {
  getCourierProductStockReport,
} = require("../courierProductStock/courierProductStock.service");
const {
  getSupplierReceivableReport,
  getSupplierDueReport,
} = require("../supplier/supplier.service");
const {
  getManufacturerReceivableReport,
  getManufacturerDueReport,
} = require("../manufacturer/manufacturer.service");
const {
  getPackagingManufacturerReceivableReport,
} = require("../packagingManufacturer/packagingManufacturer.service");
const {
  getLenderReceivableReport,
  getLenderPayableReport,
} = require("../loan/loan.service");
const { getSalesDueReport } = require("../salesDue/salesDue.service");
const {
  getSalaryAdvanceReport,
} = require("../salaryAdvance/salaryAdvance.service");
const {
  getPendingPayrollSalaryReport,
} = require("../payrollRun/payrollRun.service");
const {
  getDirectorInvestmentReport,
} = require("../director/director.service");

const ReceivedProduct = db.receivedProduct;
const PurchaseReturnProduct = db.purchaseReturnProduct;
const InTransitProduct = db.inTransitProduct;
const ReturnProduct = db.returnProduct;
const ConfirmOrder = db.confirmOrder;
const DamageProduct = db.damageProduct;
const DamageRepair = db.damageRepair;
const DamageRepaired = db.damageRepaired;
const Product = db.product;
const InventoryMaster = db.inventoryMaster;
const DamageStock = db.damageStock;
const DamageReparingStock = db.damageReparingStock;
const StockMovement = db.stockMovement;
const ItemMaster = db.itemMaster;
const PackagingItemStock = db.packagingItemStock;

const n = (v) => Number(v || 0);
const REPORT_STOCK_FIELDS = [
  "Id",
  "name",
  "quantity",
  "date",
  "createdAt",
  "productId",
  "variants",
  "purchase_price",
  "sale_price",
];

const overviewSources = [
  {
    key: "totalReceivedProduct",
    label: "Purchase Product",
    aliases: ["Received Product"],
    Model: ReceivedProduct,
    include: () => [
      {
        model: Product,
        attributes: [],
        required: true,
        where: { deletedAt: { [Op.is]: null } },
      },
    ],
  },
  {
    key: "totalPurchaseReturnProduct",
    label: "Purchase Return",
    aliases: ["Purchase Return Product"],
    Model: PurchaseReturnProduct,
    include: () => [
      {
        model: InventoryMaster,
        attributes: [],
        required: true,
        include: [
          {
            model: Product,
            attributes: [],
            required: true,
            where: { deletedAt: { [Op.is]: null } },
          },
        ],
      },
    ],
  },
  {
    key: "totalIntransitProduct",
    label: "Intransit Product",
    aliases: ["In Transit Product"],
    Model: InTransitProduct,
    include: () => [
      {
        model: InventoryMaster,
        attributes: [],
        required: true,
        include: [
          {
            model: Product,
            attributes: [],
            required: true,
            where: { deletedAt: { [Op.is]: null } },
          },
        ],
      },
    ],
  },
  {
    key: "totalSalesReturnProduct",
    label: "Sales Return",
    aliases: ["Sales Return Product"],
    Model: ReturnProduct,
    include: () => [
      {
        model: InventoryMaster,
        attributes: [],
        required: true,
        include: [
          {
            model: Product,
            attributes: [],
            required: true,
            where: { deletedAt: { [Op.is]: null } },
          },
        ],
      },
    ],
  },
  {
    key: "totalConfirmOrder",
    label: "POS",
    aliases: ["Confirm Order"],
    Model: ConfirmOrder,
    include: () => [
      {
        model: Product,
        as: "product",
        attributes: [],
        required: true,
        where: { deletedAt: { [Op.is]: null } },
      },
    ],
  },
  {
    key: "totalDamageProduct",
    label: "Damage Product",
    Model: DamageProduct,
    include: () => [
      {
        model: InventoryMaster,
        attributes: [],
        required: true,
        include: [
          {
            model: Product,
            attributes: [],
            required: true,
            where: { deletedAt: { [Op.is]: null } },
          },
        ],
      },
    ],
  },
  {
    key: "totalDamageRepair",
    label: "Damage Repair",
    Model: DamageRepair,
    include: () => [
      {
        model: DamageStock,
        attributes: [],
        required: true,
        include: [
          {
            model: Product,
            attributes: [],
            required: true,
            where: { deletedAt: { [Op.is]: null } },
          },
        ],
      },
    ],
  },
  {
    key: "totalDamageRepaired",
    label: "Damage Repaired",
    Model: DamageRepaired,
    include: () => [
      {
        model: DamageReparingStock,
        attributes: [],
        required: true,
        include: [
          {
            model: Product,
            attributes: [],
            required: true,
            where: { deletedAt: { [Op.is]: null } },
          },
        ],
      },
    ],
  },
];

const buildDateWhere = (from, to) => {
  if (!from && !to) return {};

  // strict mode
  if (!from || !to) {
    throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
  }

  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  return { date: { [Op.between]: [start, end] } };
};

const buildNameWhere = (name) => {
  if (!name) return {};
  return {
    name: { [Op.like]: `%${String(name).trim()}%` },
  };
};

const buildTotalQuantityWhere = (totalQuantity) => {
  if (totalQuantity === undefined || totalQuantity === null || totalQuantity === "") {
    return {};
  }

  const parsedTotalQuantity = Number(totalQuantity);

  if (Number.isNaN(parsedTotalQuantity)) {
    throw new ApiError(400, "totalQuantity অবশ্যই number হতে হবে");
  }

  return {
    quantity: parsedTotalQuantity,
  };
};

const buildOverviewWhere = (filters = {}) => {
  const { from, to, name, totalQuantity } = filters;

  return {
    ...buildDateWhere(from, to),
    ...buildNameWhere(name),
    ...buildTotalQuantityWhere(totalQuantity),
  };
};

const getSelectedSources = (source) => {
  if (!source) return overviewSources;

  const normalizedSource = String(source).trim().toLowerCase();

  return overviewSources.filter(
    ({ label, key, aliases = [] }) =>
      label.toLowerCase() === normalizedSource ||
      key.toLowerCase() === normalizedSource ||
      aliases.some((alias) => alias.toLowerCase() === normalizedSource),
  );
};

const findRows = async (Model, where = {}, label, include = []) => {
  const modelAttributes = Model.rawAttributes || {};
  const attributes = [
    "Id",
    "name",
    "quantity",
    "date",
    "createdAt",
    "productId",
    "variants",
    "purchase_price",
    "sale_price",
    "fifo_cost",
  ].filter((attribute) => modelAttributes[attribute]);

  const rows = await Model.findAll({
    where,
    include,
    attributes,
    order: [
      [modelAttributes.date ? "date" : "createdAt", "DESC"],
      ["Id", "DESC"],
    ],
  });

  return rows.map((r) => ({
    source: label,
    Id: r.Id,
    name: r.name,
    productId: r.productId,
    quantity: n(r.quantity),
    purchase_price: n(r.purchase_price),
    sale_price: n(r.sale_price),
    fifo_cost: modelAttributes.fifo_cost ? r.fifo_cost : null,
    variants: r.variants || [],
    date: r.date,
    createdAt: r.createdAt,
  }));
};

// For dispatch (Intransit) and Sales Return rows the money is frozen on the row
// itself at transaction time — the reports read that, never the current catalog.
// Purchase side prefers the FIFO cost, falling back to the frozen line total.
const FROZEN_MONEY_SOURCES = new Set(["Intransit Product", "Sales Return"]);

const rowPurchaseValue = (row, priceByName) => {
  if (FROZEN_MONEY_SOURCES.has(row.source)) {
    // fifo_cost === 0 means "recorded, genuinely zero" (no-invention rule) and
    // must stay 0 — only fall back to purchase_price when it was never set
    // (null/undefined). `n(row.fifo_cost) || ...` would wrongly treat 0 the
    // same as unset, diverging from the Dashboard's SQL COALESCE (which only
    // substitutes on NULL) and inflating this page's Total Purchase.
    return row.fifo_cost === null || row.fifo_cost === undefined
      ? n(row.purchase_price)
      : n(row.fifo_cost);
  }
  return n(row.quantity) * getStockPriceForRow(priceByName, row).purchase_price;
};

const rowSaleValue = (row, priceByName) => {
  if (FROZEN_MONEY_SOURCES.has(row.source)) {
    return n(row.sale_price);
  }
  return n(row.quantity) * getStockPriceForRow(priceByName, row).sale_price;
};

const parseRowVariants = (row) => {
  if (Array.isArray(row.variants)) return row.variants;
  try { return JSON.parse(row.variants || "[]"); } catch { return []; }
};

const normalizeProductNameKey = (name) => String(name || "").trim().toLowerCase();

// Purchase Price / Sale Price for every row (and the Total Purchase/Total
// Sale summary cards) are driven by ONE source: the Stock Product's current
// catalog price — never each movement's own recorded purchase_price/sale_price
// field. Those movement-level fields are inconsistent across sources (some
// store a unit price, some a pre-computed total, some leave it at 0) and
// drift out of sync with the catalog over time, which previously made the
// numbers on screen hard to trust. Using the Stock Product price everywhere
// means the displayed unit price always matches what's summed into the
// totals — if that price is 0, both correctly show/add 0.
const getStockPriceMap = async (rows) => {
  const rawNames = Array.from(
    new Set(rows.map((row) => String(row.name || "").trim()).filter(Boolean)),
  );

  const priceByName = new Map();
  if (!rawNames.length) return priceByName;

  const stockRows = await InventoryMaster.findAll({
    where: { name: { [Op.in]: rawNames } },
    attributes: ["name", "purchase_price", "sale_price"],
    paranoid: true,
  });

  stockRows.forEach((stockRow) => {
    const key = normalizeProductNameKey(stockRow.name);
    if (key && !priceByName.has(key)) {
      priceByName.set(key, {
        purchase_price: n(stockRow.purchase_price),
        sale_price: n(stockRow.sale_price),
      });
    }
  });

  return priceByName;
};

const getStockPriceForRow = (priceByName, row) =>
  priceByName.get(normalizeProductNameKey(row.name)) || {
    purchase_price: 0,
    sale_price: 0,
  };

const buildInventoryReportWhere = (Model, filters = {}) => {
  const { from, to, name } = filters;
  const modelAttributes = Model.rawAttributes || {};
  const where = {
    ...buildNameWhere(name),
  };

  if (from || to) {
    const dateWhere = buildDateWhere(from, to);
    const dateField = modelAttributes.date ? "date" : "createdAt";
    where[dateField] = dateWhere.date;
  }

  return where;
};

const getInventoryReportAttributes = (Model) => {
  const modelAttributes = Model.rawAttributes || {};
  return REPORT_STOCK_FIELDS.filter((attribute) => modelAttributes[attribute]);
};

const getRowProductKey = (row = {}) => {
  const productId = row.productId ? `product:${row.productId}` : "";
  if (productId) return productId;
  return `name:${String(row.name || "").trim().toLowerCase()}`;
};

const getReportRowValue = (row, priceField, { priceIsTotal = false } = {}) => {
  const variants = parseRowVariants(row);

  if (variants.length) {
    const hasVariantPrices = variants.some((variant) => n(variant?.[priceField]) > 0);
    if (hasVariantPrices) {
      return variants.reduce(
        (sum, variant) => sum + n(variant?.quantity) * n(variant?.[priceField]),
        0,
      );
    }
    if (priceIsTotal) return n(row?.[priceField]);
  }

  return priceIsTotal
    ? n(row?.[priceField])
    : n(getInventoryDisplayQuantity(row)) * n(row?.[priceField]);
};

const getCatalogUnitPrice = (catalogPriceByKey, row, field) =>
  catalogPriceByKey.get(getRowProductKey(row))?.[field] ||
  catalogPriceByKey.get(`name:${String(row.name || "").trim().toLowerCase()}`)?.[
    field
  ] ||
  n(row?.[field]);

const addInventoryReportRows = (
  reportMap,
  rows = [],
  quantityKey,
  { priceIsTotal = false, multiplier = 1, catalogPriceByKey = null } = {},
) => {
  const purchaseCostKeyByQuantityKey = {
    stockProduct: "stockProductPurchaseCost",
    damageStock: "damageStockPurchaseCost",
    repairingStock: "repairingStockPurchaseCost",
  };
  const salesCostKeyByQuantityKey = {
    stockProduct: "stockProductSalesCost",
    damageStock: "damageStockSalesCost",
    repairingStock: "repairingStockSalesCost",
  };
  const purchaseCostKey = purchaseCostKeyByQuantityKey[quantityKey];
  const salesCostKey = salesCostKeyByQuantityKey[quantityKey];

  rows.forEach((row) => {
    const plain = typeof row?.get === "function" ? row.get({ plain: true }) : row;
    const key = getRowProductKey(plain);
    if (!key || key === "name:") return;

    const existing = reportMap.get(key) || {
      productId: plain.productId || null,
      productsName: plain.name || "-",
      stockProduct: 0,
      damageStock: 0,
      repairingStock: 0,
      stockProductPurchaseCost: 0,
      damageStockPurchaseCost: 0,
      repairingStockPurchaseCost: 0,
      stockProductSalesCost: 0,
      damageStockSalesCost: 0,
      repairingStockSalesCost: 0,
      totalProducts: 0,
      totalPurchaseCost: 0,
      totalSalesCost: 0,
    };

    const quantity = n(getInventoryDisplayQuantity(plain)) * multiplier;
    const purchasePriceRow = catalogPriceByKey
      ? {
          ...plain,
          purchase_price: getCatalogUnitPrice(
            catalogPriceByKey,
            plain,
            "purchase_price",
          ),
        }
      : plain;
    const salesPriceRow = catalogPriceByKey
      ? {
          ...plain,
          sale_price: getCatalogUnitPrice(catalogPriceByKey, plain, "sale_price"),
        }
      : plain;
    existing.productId = existing.productId || plain.productId || null;
    existing.productsName = existing.productsName || plain.name || "-";
    existing[quantityKey] += quantity;
    existing.totalProducts += quantity;
    const purchaseCost =
      getReportRowValue(purchasePriceRow, "purchase_price", { priceIsTotal }) *
      multiplier;
    const salesCost =
      getReportRowValue(salesPriceRow, "sale_price", { priceIsTotal }) *
      multiplier;
    if (purchaseCostKey) existing[purchaseCostKey] += purchaseCost;
    if (salesCostKey) existing[salesCostKey] += salesCost;
    existing.totalPurchaseCost += purchaseCost;
    existing.totalSalesCost += salesCost;

    reportMap.set(key, existing);
  });
};

const normalizeDateValue = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const normalizeStartOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildFutureDateWhere = (to) => {
  if (!to) return null;

  return {
    date: {
      [Op.gt]: normalizeDateValue(to),
    },
  };
};

const getCatalogPriceMapByKey = async (rows = []) => {
  const map = new Map();

  rows.forEach((row) => {
    const plain = typeof row?.get === "function" ? row.get({ plain: true }) : row;
    const price = {
      purchase_price: n(plain.purchase_price),
      sale_price: n(plain.sale_price),
    };
    const key = getRowProductKey(plain);
    if (key && key !== "name:") map.set(key, price);
    const nameKey = `name:${String(plain.name || "").trim().toLowerCase()}`;
    if (nameKey !== "name:") map.set(nameKey, price);
  });

  return map;
};

const getCurrentStockRows = async (filters = {}) => {
  const nameWhere = buildNameWhere(filters.name);

  return Promise.all([
    InventoryMaster.findAll({
      where: nameWhere,
      attributes: getInventoryReportAttributes(InventoryMaster),
      paranoid: true,
    }),
    DamageStock.findAll({
      where: nameWhere,
      attributes: getInventoryReportAttributes(DamageStock),
      paranoid: true,
    }),
    DamageReparingStock.findAll({
      where: nameWhere,
      attributes: getInventoryReportAttributes(DamageReparingStock),
      paranoid: true,
    }),
  ]);
};

// Fetches every stock-affecting movement row matching `dateWhere` — shared by
// the "reverse from current stock" (future rows) and "ledger between two
// dates" (from-onward rows) calculations below. "Damage Return" / "Damage
// Repairing Return" are split into their own buckets because they move stock
// in the opposite direction of a normal damage/repair entry (see
// MOVEMENT_STOCK_SIGNS).
const getMovementRowsWhere = async (dateWhere) => {
  const sourceNotDamageReturn = {
    [Op.or]: [
      { source: { [Op.ne]: "Damage Return" } },
      { source: { [Op.is]: null } },
    ],
  };
  const sourceNotRepairingReturn = {
    [Op.or]: [
      { source: { [Op.ne]: "Damage Repairing Return" } },
      { source: { [Op.is]: null } },
    ],
  };

  const [
    receivedRows,
    purchaseReturnRows,
    inTransitRows,
    salesReturnRows,
    confirmOrderRows,
    damageProductRows,
    damageReturnRows,
    damageRepairRows,
    damageRepairingReturnRows,
    damageRepairedRows,
  ] = await Promise.all([
    ReceivedProduct.findAll({
      where: dateWhere,
      attributes: getInventoryReportAttributes(ReceivedProduct),
      paranoid: true,
    }),
    PurchaseReturnProduct.findAll({
      where: dateWhere,
      attributes: getInventoryReportAttributes(PurchaseReturnProduct),
      paranoid: true,
    }),
    InTransitProduct.findAll({
      where: dateWhere,
      attributes: getInventoryReportAttributes(InTransitProduct),
      paranoid: true,
    }),
    ReturnProduct.findAll({
      where: dateWhere,
      attributes: getInventoryReportAttributes(ReturnProduct),
      paranoid: true,
    }),
    ConfirmOrder.findAll({
      where: dateWhere,
      attributes: getInventoryReportAttributes(ConfirmOrder),
      paranoid: true,
    }),
    DamageProduct.findAll({
      where: { ...dateWhere, ...sourceNotDamageReturn },
      attributes: getInventoryReportAttributes(DamageProduct),
      paranoid: true,
    }),
    DamageProduct.findAll({
      where: { ...dateWhere, source: "Damage Return" },
      attributes: getInventoryReportAttributes(DamageProduct),
      paranoid: true,
    }),
    DamageRepair.findAll({
      where: { ...dateWhere, ...sourceNotRepairingReturn },
      attributes: getInventoryReportAttributes(DamageRepair),
      paranoid: true,
    }),
    DamageRepair.findAll({
      where: { ...dateWhere, source: "Damage Repairing Return" },
      attributes: getInventoryReportAttributes(DamageRepair),
      paranoid: true,
    }),
    DamageRepaired.findAll({
      where: dateWhere,
      attributes: getInventoryReportAttributes(DamageRepaired),
      paranoid: true,
    }),
  ]);

  return {
    receivedRows,
    purchaseReturnRows,
    inTransitRows,
    salesReturnRows,
    confirmOrderRows,
    damageProductRows,
    damageReturnRows,
    damageRepairRows,
    damageRepairingReturnRows,
    damageRepairedRows,
  };
};

const getFutureRowsAfterDate = async (to) => {
  const futureWhere = buildFutureDateWhere(to);
  if (!futureWhere) return null;
  return getMovementRowsWhere(futureWhere);
};

const getMovementRowsFromDate = async (from) => {
  if (!from) return null;
  return getMovementRowsWhere({ date: { [Op.gte]: normalizeStartOfDay(from) } });
};

// True forward-time effect of each movement source on each stock type: +1
// increases that stock type, -1 decreases it. Verified against the
// hand-written reversal multipliers this replaces (each reversal used
// `-sign` to undo a future movement) — see git history for the derivation.
const MOVEMENT_STOCK_SIGNS = {
  receivedRows: { stockProduct: 1 },
  purchaseReturnRows: { stockProduct: -1 },
  inTransitRows: { stockProduct: -1 },
  confirmOrderRows: { stockProduct: -1 },
  salesReturnRows: { stockProduct: 1 },
  damageProductRows: { stockProduct: -1, damageStock: 1 },
  damageReturnRows: { damageStock: -1 },
  damageRepairRows: { damageStock: -1, repairingStock: 1 },
  damageRepairingReturnRows: { repairingStock: -1 },
  damageRepairedRows: { stockProduct: 1, repairingStock: -1 },
};

// Applies the net signed effect of every movement bucket onto reportMap —
// used to walk the current/closing balance backward to an earlier balance
// (multiplier = -sign undoes the movement; sign = -sign of that is used by
// callers that want to further rewind past the start of the period too).
const applySignedReversal = (reportMap, rowsByKey, catalogPriceByKey) => {
  Object.entries(MOVEMENT_STOCK_SIGNS).forEach(([rowsKey, effects]) => {
    const rows = rowsByKey?.[rowsKey] || [];
    if (!rows.length) return;

    Object.entries(effects).forEach(([quantityKey, sign]) => {
      const priceIsTotal = quantityKey !== "stockProduct";
      addInventoryReportRows(reportMap, rows, quantityKey, {
        multiplier: -sign,
        priceIsTotal,
        catalogPriceByKey: priceIsTotal ? null : catalogPriceByKey,
      });
    });
  });
};

// Accumulates the plain (unsigned) quantity of every movement bucket whose
// forward effect matches `onlySign` — used to build the In-quantity and
// Out-quantity columns of the period ledger (as opposed to their net, which
// applySignedReversal computes).
const applyMovementMagnitudes = (reportMap, rowsByKey, catalogPriceByKey, onlySign) => {
  Object.entries(MOVEMENT_STOCK_SIGNS).forEach(([rowsKey, effects]) => {
    const rows = rowsByKey?.[rowsKey] || [];
    if (!rows.length) return;

    Object.entries(effects).forEach(([quantityKey, sign]) => {
      if (Math.sign(sign) !== onlySign) return;
      const priceIsTotal = quantityKey !== "stockProduct";
      addInventoryReportRows(reportMap, rows, quantityKey, {
        multiplier: 1,
        priceIsTotal,
        catalogPriceByKey: priceIsTotal ? null : catalogPriceByKey,
      });
    });
  });
};

const attachInventoryReportUnitPrices = (row) => ({
  ...row,
  stockProductPurchasePrice: row.stockProduct
    ? row.stockProductPurchaseCost / row.stockProduct
    : 0,
  damageStockPurchasePrice: row.damageStock
    ? row.damageStockPurchaseCost / row.damageStock
    : 0,
  repairingStockPurchasePrice: row.repairingStock
    ? row.repairingStockPurchaseCost / row.repairingStock
    : 0,
  stockProductSalesPrice: row.stockProduct
    ? row.stockProductSalesCost / row.stockProduct
    : 0,
  damageStockSalesPrice: row.damageStock
    ? row.damageStockSalesCost / row.damageStock
    : 0,
  repairingStockSalesPrice: row.repairingStock
    ? row.repairingStockSalesCost / row.repairingStock
    : 0,
});

const getInventoryReportsFromDB = async (filters) => {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.max(1, Number(filters.limit || 10));
  const skip = (page - 1) * limit;

  const reportMap = new Map();

  if (filters.to) {
    const [stockRows, damageRows, repairingRows] =
      await getCurrentStockRows(filters);
    const catalogPriceByKey = await getCatalogPriceMapByKey(stockRows);
    const futureRows = await getFutureRowsAfterDate(filters.to);

    addInventoryReportRows(reportMap, stockRows, "stockProduct", {
      catalogPriceByKey,
    });
    addInventoryReportRows(reportMap, damageRows, "damageStock", {
      priceIsTotal: true,
    });
    addInventoryReportRows(reportMap, repairingRows, "repairingStock", {
      priceIsTotal: true,
    });

    if (futureRows) {
      addInventoryReportRows(reportMap, futureRows.receivedRows, "stockProduct", {
        multiplier: -1,
        catalogPriceByKey,
      });
      addInventoryReportRows(
        reportMap,
        futureRows.purchaseReturnRows,
        "stockProduct",
        { multiplier: 1, catalogPriceByKey },
      );
      addInventoryReportRows(reportMap, futureRows.inTransitRows, "stockProduct", {
        multiplier: 1,
        catalogPriceByKey,
      });
      addInventoryReportRows(
        reportMap,
        futureRows.confirmOrderRows,
        "stockProduct",
        { multiplier: 1, catalogPriceByKey },
      );
      addInventoryReportRows(
        reportMap,
        futureRows.salesReturnRows,
        "stockProduct",
        { multiplier: -1, catalogPriceByKey },
      );
      addInventoryReportRows(
        reportMap,
        futureRows.damageProductRows,
        "stockProduct",
        { multiplier: 1, catalogPriceByKey },
      );
      addInventoryReportRows(
        reportMap,
        futureRows.damageRepairedRows,
        "stockProduct",
        { multiplier: -1, catalogPriceByKey },
      );

      addInventoryReportRows(reportMap, futureRows.damageProductRows, "damageStock", {
        multiplier: -1,
        priceIsTotal: true,
      });
      addInventoryReportRows(reportMap, futureRows.damageReturnRows, "damageStock", {
        multiplier: 1,
        priceIsTotal: true,
      });
      addInventoryReportRows(reportMap, futureRows.damageRepairRows, "damageStock", {
        multiplier: 1,
        priceIsTotal: true,
      });

      addInventoryReportRows(
        reportMap,
        futureRows.damageRepairRows,
        "repairingStock",
        { multiplier: -1, priceIsTotal: true },
      );
      addInventoryReportRows(
        reportMap,
        futureRows.damageRepairingReturnRows,
        "repairingStock",
        { multiplier: 1, priceIsTotal: true },
      );
      addInventoryReportRows(
        reportMap,
        futureRows.damageRepairedRows,
        "repairingStock",
        { multiplier: 1, priceIsTotal: true },
      );
    }
  } else {
    const [stockRows, damageRows, repairingRows] = await Promise.all([
      InventoryMaster.findAll({
        where: buildInventoryReportWhere(InventoryMaster, filters),
        attributes: getInventoryReportAttributes(InventoryMaster),
      }),
      DamageStock.findAll({
        where: buildInventoryReportWhere(DamageStock, filters),
        attributes: getInventoryReportAttributes(DamageStock),
      }),
      DamageReparingStock.findAll({
        where: buildInventoryReportWhere(DamageReparingStock, filters),
        attributes: getInventoryReportAttributes(DamageReparingStock),
      }),
    ]);

    addInventoryReportRows(reportMap, stockRows, "stockProduct");
    addInventoryReportRows(reportMap, damageRows, "damageStock", {
      priceIsTotal: true,
    });
    addInventoryReportRows(reportMap, repairingRows, "repairingStock", {
      priceIsTotal: true,
    });
  }

  const all = Array.from(reportMap.values())
    .map((row) => ({
      ...row,
      stockProduct: Math.max(n(row.stockProduct), 0),
      damageStock: Math.max(n(row.damageStock), 0),
      repairingStock: Math.max(n(row.repairingStock), 0),
      stockProductPurchaseCost: Math.max(n(row.stockProductPurchaseCost), 0),
      damageStockPurchaseCost: Math.max(n(row.damageStockPurchaseCost), 0),
      repairingStockPurchaseCost: Math.max(n(row.repairingStockPurchaseCost), 0),
      totalProducts: Math.max(n(row.totalProducts), 0),
      totalPurchaseCost: Math.max(n(row.totalPurchaseCost), 0),
      totalSalesCost: Math.max(n(row.totalSalesCost), 0),
    }))
    .map((row) => ({
      ...row,
      totalProducts: n(row.stockProduct) + n(row.damageStock) + n(row.repairingStock),
      totalPurchaseCost:
        n(row.stockProductPurchaseCost) +
        n(row.damageStockPurchaseCost) +
        n(row.repairingStockPurchaseCost),
      totalSalesCost:
        n(row.stockProductSalesCost) +
        n(row.damageStockSalesCost) +
        n(row.repairingStockSalesCost),
    }))
    .map(attachInventoryReportUnitPrices)
    .filter(
      (row) =>
        n(row.stockProduct) > 0 ||
        n(row.damageStock) > 0 ||
        n(row.repairingStock) > 0 ||
        n(row.totalPurchaseCost) > 0,
    )
    .sort((a, b) => String(a.productsName).localeCompare(String(b.productsName)));

  return {
    meta: {
      from: filters.from || null,
      to: filters.to || null,
      name: filters.name || null,
      page,
      limit,
      count: all.length,
      totalQuantity: all.reduce((sum, row) => sum + n(row.totalProducts), 0),
      totalPurchaseValue: all.reduce((sum, row) => sum + n(row.totalPurchaseCost), 0),
      totalSaleValue: all.reduce((sum, row) => sum + n(row.totalSalesCost), 0),
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
    },
    data: all.slice(skip, skip + limit),
  };
};

const STOCK_LEDGER_TYPES = ["stockProduct", "damageStock", "repairingStock"];

// Opening/In/Out/Closing stock ledger for a date range — the standard
// accounting-book shape ("stock as of the 25th, given movements 26th-25th"),
// used by the monthly book statement. Closing is computed by rewinding
// today's live stock past every movement dated after `to`; Opening rewinds
// further, past every movement dated `from` or later too. In/Out are the
// plain (unsigned) totals of movements dated inside [from, to], so by
// construction Opening + In - Out always equals Closing.
const computeInventoryLedgerReport = async ({ from, to, name } = {}) => {
  if (!from || !to) {
    throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
  }

  const [stockRows, damageRows, repairingRows] = await getCurrentStockRows({
    name,
  });
  const catalogPriceByKey = await getCatalogPriceMapByKey(stockRows);

  const toBoundary = normalizeDateValue(to);
  const movementRows = await getMovementRowsFromDate(from);

  const inPeriodRowsByKey = {};
  const afterPeriodRowsByKey = {};
  Object.entries(movementRows || {}).forEach(([key, rows]) => {
    inPeriodRowsByKey[key] = [];
    afterPeriodRowsByKey[key] = [];
    rows.forEach((row) => {
      const plain = typeof row?.get === "function" ? row.get({ plain: true }) : row;
      const rowDate = new Date(plain.date);
      if (rowDate <= toBoundary) inPeriodRowsByKey[key].push(plain);
      else afterPeriodRowsByKey[key].push(plain);
    });
  });

  const seedCurrentStock = (map) => {
    addInventoryReportRows(map, stockRows, "stockProduct", { catalogPriceByKey });
    addInventoryReportRows(map, damageRows, "damageStock", { priceIsTotal: true });
    addInventoryReportRows(map, repairingRows, "repairingStock", {
      priceIsTotal: true,
    });
  };

  const closingMap = new Map();
  seedCurrentStock(closingMap);
  applySignedReversal(closingMap, afterPeriodRowsByKey, catalogPriceByKey);

  const openingMap = new Map();
  seedCurrentStock(openingMap);
  applySignedReversal(openingMap, afterPeriodRowsByKey, catalogPriceByKey);
  applySignedReversal(openingMap, inPeriodRowsByKey, catalogPriceByKey);

  const inMap = new Map();
  applyMovementMagnitudes(inMap, inPeriodRowsByKey, catalogPriceByKey, 1);

  const outMap = new Map();
  applyMovementMagnitudes(outMap, inPeriodRowsByKey, catalogPriceByKey, -1);

  const productKeys = new Set([
    ...closingMap.keys(),
    ...openingMap.keys(),
    ...inMap.keys(),
    ...outMap.keys(),
  ]);

  const all = Array.from(productKeys)
    .map((key) => {
      const closing = closingMap.get(key) || {};
      const opening = openingMap.get(key) || {};
      const inRow = inMap.get(key) || {};
      const outRow = outMap.get(key) || {};
      const productsName =
        closing.productsName ||
        opening.productsName ||
        inRow.productsName ||
        outRow.productsName ||
        "-";
      const productId =
        closing.productId || opening.productId || inRow.productId || outRow.productId || null;

      const row = { productId, productsName };

      STOCK_LEDGER_TYPES.forEach((stockType) => {
        const closingQty = Math.max(n(closing[stockType]), 0);
        const closingCost = Math.max(n(closing[`${stockType}PurchaseCost`]), 0);

        row[`${stockType}Opening`] = Math.max(n(opening[stockType]), 0);
        row[`${stockType}In`] = Math.max(n(inRow[stockType]), 0);
        row[`${stockType}Out`] = Math.max(n(outRow[stockType]), 0);
        row[`${stockType}Closing`] = closingQty;
        row[`${stockType}PurchasePrice`] = closingQty ? closingCost / closingQty : 0;
        row[`${stockType}ClosingPurchaseCost`] = closingCost;
      });

      return row;
    })
    .filter((row) =>
      STOCK_LEDGER_TYPES.some(
        (stockType) =>
          n(row[`${stockType}Opening`]) > 0 ||
          n(row[`${stockType}In`]) > 0 ||
          n(row[`${stockType}Out`]) > 0 ||
          n(row[`${stockType}Closing`]) > 0,
      ),
    )
    .sort((a, b) => String(a.productsName).localeCompare(String(b.productsName)));

  return {
    meta: { from, to, name: name || null, count: all.length },
    data: all,
  };
};

// stockType as stored on StockMovement -> the report's field-name prefix.
const STOCK_MOVEMENT_TYPE_PREFIX = {
  ProductStock: "stockProduct",
  DamageStock: "damageStock",
  RepairingStock: "repairingStock",
};

// Opening/In/Out/Closing per product, built directly from the immutable
// StockMovement ledger (see shared/stockMovementLogger.js) instead of
// replaying every source table's sign conventions. Closing is simply the
// balanceAfter of the last movement on or before `to`; Opening is the
// balanceAfter of the last movement strictly before `from` (0 if the
// product has no movement logged before the range — i.e. no history prior
// to whenever logging started for it). Only movements recorded *after*
// this ledger went live are covered; older activity that predates it has
// no rows here by design.
const computeStockMovementLedgerReport = async ({ from, to, name } = {}) => {
  if (!from || !to) {
    throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
  }
  if (!StockMovement) return { meta: { from, to, count: 0 }, data: [] };

  const nameWhere = buildNameWhere(name);
  const [rows, currentPriceRows] = await Promise.all([
    StockMovement.findAll({
      where: { ...nameWhere, date: { [Op.lte]: to } },
      order: [
        ["date", "ASC"],
        ["createdAt", "ASC"],
        ["Id", "ASC"],
      ],
      raw: true,
    }),
    InventoryMaster.findAll({
      where: nameWhere,
      attributes: ["productId", "purchase_price"],
      raw: true,
    }),
  ]);
  const purchasePriceByProductId = new Map(
    currentPriceRows.map((row) => [Number(row.productId), n(row.purchase_price)]),
  );

  const map = new Map();

  rows.forEach((row) => {
    const stockType = STOCK_MOVEMENT_TYPE_PREFIX[row.stockType];
    if (!stockType || !row.productId) return;

    const key = `${row.productId}`;
    if (!map.has(key)) {
      map.set(key, { productId: row.productId, productsName: row.name });
    }
    const entry = map.get(key);
    entry.productsName = row.name || entry.productsName;

    const closingQty = n(row.balanceAfter);
    entry[`${stockType}Closing`] = closingQty;
    entry[`${stockType}PurchasePrice`] =
      purchasePriceByProductId.get(Number(row.productId)) || 0;

    if (row.date < from) {
      entry[`${stockType}Opening`] = closingQty;
    } else {
      const change = n(row.quantityChange);
      entry[`${stockType}In`] = n(entry[`${stockType}In`]) + Math.max(change, 0);
      entry[`${stockType}Out`] =
        n(entry[`${stockType}Out`]) + Math.max(-change, 0);
    }
  });

  const all = Array.from(map.values())
    .map((row) => {
      const result = { productId: row.productId, productsName: row.productsName };
      STOCK_LEDGER_TYPES.forEach((stockType) => {
        const closing = n(row[`${stockType}Closing`]);
        result[`${stockType}Opening`] = n(row[`${stockType}Opening`]);
        result[`${stockType}In`] = n(row[`${stockType}In`]);
        result[`${stockType}Out`] = n(row[`${stockType}Out`]);
        result[`${stockType}Closing`] = closing;
        result[`${stockType}PurchasePrice`] = n(row[`${stockType}PurchasePrice`]);
        result[`${stockType}ClosingPurchaseCost`] =
          closing * n(row[`${stockType}PurchasePrice`]);
      });
      return result;
    })
    .filter((row) =>
      STOCK_LEDGER_TYPES.some(
        (stockType) =>
          n(row[`${stockType}Opening`]) > 0 ||
          n(row[`${stockType}In`]) > 0 ||
          n(row[`${stockType}Out`]) > 0 ||
          n(row[`${stockType}Closing`]) > 0,
      ),
    )
    .sort((a, b) => String(a.productsName).localeCompare(String(b.productsName)));

  return {
    meta: { from, to, name: name || null, count: all.length },
    data: all,
  };
};

// Closing-only sibling of computeStockMovementLedgerReport, for stock pools
// that don't need Opening/In/Out — just "how much is on hand as of `to`",
// grouped by whichever id field StockMovement was logged with for that pool
// (productId for Product/Damage/Repairing, itemId for everything else).
const computeStockMovementClosingReport = async ({
  to,
  name,
  groupIdField,
  stockTypeMap,
  priceByGroupId,
}) => {
  if (!to) {
    throw new ApiError(400, "to তারিখ দিতে হবে (YYYY-MM-DD)");
  }
  if (!StockMovement) return { meta: { to, count: 0 }, data: [] };

  const nameWhere = buildNameWhere(name);
  const stockTypeValues = Object.keys(stockTypeMap);
  const rows = await StockMovement.findAll({
    where: {
      ...nameWhere,
      date: { [Op.lte]: to },
      stockType: { [Op.in]: stockTypeValues },
    },
    order: [
      ["date", "ASC"],
      ["createdAt", "ASC"],
      ["Id", "ASC"],
    ],
    raw: true,
  });

  const map = new Map();
  rows.forEach((row) => {
    const prefix = stockTypeMap[row.stockType];
    const groupId = row[groupIdField];
    if (!prefix || !groupId) return;

    const key = String(groupId);
    if (!map.has(key)) map.set(key, { groupId, name: row.name });
    const entry = map.get(key);
    entry.name = row.name || entry.name;
    entry[`${prefix}Closing`] = n(row.balanceAfter);
  });

  const prefixes = [...new Set(Object.values(stockTypeMap))];
  const all = Array.from(map.values())
    .map((row) => {
      const result = { groupId: row.groupId, name: row.name };
      prefixes.forEach((prefix) => {
        result[`${prefix}Closing`] = n(row[`${prefix}Closing`]);
      });
      result.purchasePrice = priceByGroupId.get(Number(row.groupId)) || 0;
      return result;
    })
    .filter((row) => prefixes.some((prefix) => n(row[`${prefix}Closing`]) > 0))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return {
    meta: { to, name: name || null, count: all.length },
    data: all,
  };
};

const buildUnitPriceMap = (rows, idField) => {
  const map = new Map();
  rows.forEach((row) => {
    const id = Number(row[idField]);
    if (!id) return;
    const qty = n(row.unitValue);
    map.set(id, qty ? n(row.cost) / qty : 0);
  });
  return map;
};

// Item Stock (general raw-material pool) + Factory Stock (the same item,
// held against a specific manufacturer) — both keyed by itemId.
const computeItemFactoryStockReport = async ({ to, name } = {}) => {
  const currentRows = await ItemMaster.findAll({
    where: buildNameWhere(name),
    attributes: ["itemId", "cost", "unitValue"],
    raw: true,
  });

  return computeStockMovementClosingReport({
    to,
    name,
    groupIdField: "itemId",
    stockTypeMap: { ItemStock: "itemStock", FactoryStock: "factoryStock" },
    priceByGroupId: buildUnitPriceMap(currentRows, "itemId"),
  });
};

// Packaging Item Stock + Packaging Factory Stock — both keyed by
// packagingItemId (logged onto StockMovement.itemId).
const computePackagingStockReport = async ({ to, name } = {}) => {
  const currentRows = await PackagingItemStock.findAll({
    where: buildNameWhere(name),
    attributes: ["packagingItemId", "cost", "unitValue"],
    raw: true,
  });

  return computeStockMovementClosingReport({
    to,
    name,
    groupIdField: "itemId",
    stockTypeMap: {
      PackagingItemStock: "packagingItemStock",
      PackagingFactoryStock: "packagingFactoryStock",
    },
    priceByGroupId: buildUnitPriceMap(currentRows, "packagingItemId"),
  });
};

// Summary wrapper consumed by the Dashboard and the Monthly Reporting Book
// PDF — one place for both, replacing the two near-identical copies that
// used to live in overview.service.js and monthlyReportingBook.service.js.
const getInventoryStockReport = async ({ from, to } = {}) => {
  const [
    report,
    itemFactoryStock,
    packagingStock,
    courierProductStock,
    supplierReceivable,
    manufacturerReceivable,
    packagingManufacturerReceivable,
    lenderReceivable,
    salesDue,
    salaryAdvance,
    pendingPayrollSalary,
    supplierDue,
    manufacturerDue,
    lenderPayable,
    directorInvestment,
  ] = await Promise.all([
    computeStockMovementLedgerReport({ from, to }),
    computeItemFactoryStockReport({ to }),
    computePackagingStockReport({ to }),
    getCourierProductStockReport({ from, to }),
    getSupplierReceivableReport({ to }),
    getManufacturerReceivableReport({ to }),
    getPackagingManufacturerReceivableReport({ to }),
    getLenderReceivableReport({ to }),
    getSalesDueReport(),
    getSalaryAdvanceReport(),
    getPendingPayrollSalaryReport({ from, to }),
    getSupplierDueReport(),
    getManufacturerDueReport(),
    getLenderPayableReport(),
    getDirectorInvestmentReport(),
  ]);
  const rows = report.data || [];

  const sumStockType = (stockType, field) =>
    rows.reduce((sum, row) => sum + n(row[`${stockType}${field}`]), 0);

  return {
    meta: {
      count: report.meta?.count || rows.length,
      from: report.meta?.from || null,
      to: report.meta?.to || null,
      totalStockProduct: sumStockType("stockProduct", "Closing"),
      totalDamageStock: sumStockType("damageStock", "Closing"),
      totalRepairingStock: sumStockType("repairingStock", "Closing"),
      totalProducts:
        sumStockType("stockProduct", "Closing") +
        sumStockType("damageStock", "Closing") +
        sumStockType("repairingStock", "Closing"),
      totalPurchaseCost:
        sumStockType("stockProduct", "ClosingPurchaseCost") +
        sumStockType("damageStock", "ClosingPurchaseCost") +
        sumStockType("repairingStock", "ClosingPurchaseCost"),
    },
    data: rows,
    itemFactoryStock,
    packagingStock,
    courierProductStock,
    supplierReceivable,
    manufacturerReceivable,
    packagingManufacturerReceivable,
    lenderReceivable,
    salesDue,
    salaryAdvance,
    pendingPayrollSalary,
    supplierDue,
    manufacturerDue,
    lenderPayable,
    directorInvestment,
  };
};

const attachRowUnitPricing = (rows, priceByName) =>
  rows.map((row) => {
    const stockPrice = getStockPriceForRow(priceByName, row);
    const qty = n(row.quantity);
    const frozen = FROZEN_MONEY_SOURCES.has(row.source);

    return {
      ...row,
      unitPurchasePrice:
        frozen && qty > 0
          ? rowPurchaseValue(row, priceByName) / qty
          : stockPrice.purchase_price,
      unitSalePrice:
        frozen && qty > 0
          ? rowSaleValue(row, priceByName) / qty
          : stockPrice.sale_price,
      // This movement's own variant/quantity split (e.g. which batches went
      // into this specific Intransit entry) — parsed since it can arrive as
      // a raw JSON string rather than an already-decoded array. Shown for
      // reference only; pricing for these is the same flat Stock Product
      // price as the row, not tracked per variant.
      variants: parseRowVariants(row),
    };
  });

const getInventoryOverviewListFromDB = async (filters) => {
  const { from, to, name, source, totalQuantity: requestedTotalQuantity } = filters;

  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.max(1, Number(filters.limit || 10));
  const skip = (page - 1) * limit;

  const where = buildOverviewWhere({
    from,
    to,
    name,
    totalQuantity: requestedTotalQuantity,
  });
  const selectedSources = getSelectedSources(source);

  const rowsBySource = await Promise.all(
    selectedSources.map(({ Model, label, include }) =>
      findRows(Model, where, label, include ? include() : []),
    ),
  );

  const all = rowsBySource.flat().sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const dbb = b.date ? new Date(b.date).getTime() : 0;
    if (dbb !== da) return dbb - da;
    return (b.Id || 0) - (a.Id || 0);
  });
  const priceByName = await getStockPriceMap(all);

  const totalQuantity = all.reduce((sum, row) => sum + n(row.quantity), 0);
  const totalPurchaseValue = all.reduce(
    (sum, row) => sum + rowPurchaseValue(row, priceByName),
    0,
  );
  const totalSaleValue = all.reduce(
    (sum, row) => sum + rowSaleValue(row, priceByName),
    0,
  );

  const paged = attachRowUnitPricing(all.slice(skip, skip + limit), priceByName);

  const stockLayerValueRow = db.inventoryCostLayer
    ? await db.inventoryCostLayer.findOne({
        attributes: [
          [
            db.Sequelize.fn(
              "SUM",
              db.Sequelize.literal("remainingQty * unitCost"),
            ),
            "value",
          ],
        ],
        raw: true,
      })
    : null;

  return {
    meta: {
      from: from || null,
      to: to || null,
      name: name || null,
      source: source || null,
      stockLayerValue: n(stockLayerValueRow && stockLayerValueRow.value),
      requestedTotalQuantity:
        requestedTotalQuantity === undefined ||
        requestedTotalQuantity === null ||
        requestedTotalQuantity === ""
          ? null
          : Number(requestedTotalQuantity),
      page,
      limit,
      count: all.length,
      totalQuantity,
      totalPurchaseValue,
      totalSaleValue,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
    },
    data: paged,
  };
};
// summary (আগেরটা রাখতে চাইলে)
const sumField = async (Model, field, where = {}) => {
  const total = await Model.sum(field, { where });
  return n(total);
};

const getInventoryOverviewSummaryFromDB = async (filters) => {
  const { from, to } = filters;
  const dateWhere = buildDateWhere(from, to);

  const [
    totalReceivedProduct,
    totalPurchaseReturnProduct,
    totalIntransitProduct,
    totalSalesReturnProduct,
    totalConfirmOrder,
    totalDamageProduct,
    totalDamageRepair,
    totalDamageRepaired,
  ] = await Promise.all([
    sumField(ReceivedProduct, "quantity", dateWhere),
    sumField(PurchaseReturnProduct, "quantity", dateWhere),
    sumField(InTransitProduct, "quantity", dateWhere),
    sumField(ReturnProduct, "quantity", dateWhere),
    sumField(ConfirmOrder, "quantity", dateWhere),
    sumField(DamageProduct, "quantity", dateWhere),
    sumField(DamageRepair, "quantity", dateWhere),
    sumField(DamageRepaired, "quantity", dateWhere),
  ]);

  const totalQuantity =
    totalReceivedProduct +
    totalPurchaseReturnProduct +
    totalIntransitProduct +
    totalSalesReturnProduct +
    totalConfirmOrder +
    totalDamageProduct +
    totalDamageRepair +
    totalDamageRepaired;

  return {
    from: from || null,
    to: to || null,
    totalReceivedProduct,
    totalPurchaseReturnProduct,
    totalIntransitProduct,
    totalSalesReturnProduct,
    totalConfirmOrder,
    totalDamageProduct,
    totalDamageRepair,
    totalDamageRepaired,
    totalQuantity,
  };
};

module.exports = {
  getInventoryOverviewListFromDB,
  getInventoryOverviewSummaryFromDB,
  getInventoryReportsFromDB,
  computeInventoryLedgerReport,
  computeStockMovementLedgerReport,
  computeItemFactoryStockReport,
  computePackagingStockReport,
  getInventoryStockReport,
};

const { collectStockBalances } = require("../../../shared/stockReportBalances");
const { getFundTransferPaymentModeRows } = require("../../../shared/fundTransferPaymentModes");
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
  getDollarSupplierReceivableReport,
  getDollarSupplierDueReport,
} = require("../dollarSupplier/dollarSupplier.service");
const {
  getManufacturerReceivableReport,
  getManufacturerDueReport,
} = require("../manufacturer/manufacturer.service");
const {
  getPackagingManufacturerReceivableReport,
  getPackagingManufacturerDueReport,
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
const {
  currentAverageCostMap: currentAverageProductCostMap,
  lastKnownUnitCostMap: lastKnownProductUnitCostMap,
} = require("../../../shared/fifoCostLayers");
const {
  lastKnownUnitCostMap: lastKnownItemUnitCostMap,
} = require("../../../shared/itemFifoCostLayers");
const {
  lastKnownUnitCostMap: lastKnownPackagingUnitCostMap,
} = require("../../../shared/packagingFifoCostLayers");
const {
  buildItemUnitCostResolver,
} = require("../../../shared/itemUnitCostResolver");
const {
  buildPackagingUnitCostResolver,
} = require("../../../shared/packagingUnitCostResolver");

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
const ManufactureStock = db.manufactureStock;
const PackagingFactoryStock = db.packagingFactoryStock;
const CashInOut = db.cashInOut;
const PettyCash = db.pettyCash;

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

// Sales totals for dispatch and returns remain recorded transaction totals.
const FROZEN_MONEY_SOURCES = new Set(["Intransit Product", "Sales Return"]);

// Overview History values every purchase using the current database price.
const rowPurchaseValue = (row, priceByName) =>
  n(row.quantity) * getStockPriceForRow(priceByName, row).purchase_price;

const rowSaleValue = (row, priceByName) => {
  if (FROZEN_MONEY_SOURCES.has(row.source)) {
    return n(row.sale_price);
  }
  return n(row.quantity) * getStockPriceForRow(priceByName, row).sale_price;
};

const parseRowVariants = (row) => {
  if (Array.isArray(row.variants)) return row.variants;
  try { const parsed = JSON.parse(row.variants || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

const normalizeProductNameKey = (name) => String(name || "").trim().toLowerCase();

// Match by product ID first so renamed products and duplicate names cannot
// select another product's purchase price. Names support legacy rows without IDs.
const getStockPriceMap = async (rows) => {
  const rawNames = Array.from(
    new Set(rows.map((row) => String(row.name || "").trim()).filter(Boolean)),
  );

  const priceByName = new Map();
  const productIds = [...new Set(rows.map((row) => row.productId).filter(Boolean))];
  if (!rawNames.length && !productIds.length) return priceByName;

  const stockRows = await InventoryMaster.findAll({
    where: { [Op.or]: [
      { productId: { [Op.in]: productIds } },
      { name: { [Op.in]: rawNames } },
    ] },
    attributes: ["productId", "name", "purchase_price", "sale_price"],
    paranoid: true,
  });

  stockRows.forEach((stockRow) => {
    if (stockRow.productId) {
      priceByName.set(`product:${stockRow.productId}`, {
        purchase_price: n(stockRow.purchase_price),
        sale_price: n(stockRow.sale_price),
      });
    }
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
  (row.productId
    ? priceByName.get(`product:${row.productId}`)
    : priceByName.get(normalizeProductNameKey(row.name))) || {
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
  const plainRows = rows.map((row) =>
    typeof row?.get === "function" ? row.get({ plain: true }) : row,
  );

  // Same "no invented numbers, but don't show ৳0 when real FIFO history
  // exists" fallback as the main All Books path — this map feeds the legacy
  // /inventory/reports endpoint, used as a fallback when the primary report
  // isn't available on the export.
  const productIds = plainRows.map((row) => row.productId).filter(Boolean);
  const [avgMap, lastMap] = await Promise.all([
    currentAverageProductCostMap(productIds),
    lastKnownProductUnitCostMap(productIds),
  ]);

  plainRows.forEach((plain) => {
    const pid = Number(plain.productId);
    const fifoFallback = avgMap.get(pid) || lastMap.get(pid) || 0;
    const price = {
      purchase_price: n(plain.purchase_price) || fifoFallback,
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

// Opening and closing balances are computed from effective dated movements.
const computeStockMovementLedgerReport = async ({ from, to, name } = {}) => {
  if (!from || !to) {
    throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
  }
  if (!StockMovement) return { meta: { from, to, count: 0 }, data: [] };

  const nameWhere = buildNameWhere(name);
  const [rows, currentPriceRows, damageRows, repairingRows] = await Promise.all([
    StockMovement.findAll({
      // No `date <= to` cutoff: balances are walked back from live stock, so
      // movements dated after `to` are needed too (see collectStockBalances).
      // (An empty `{}` inside Op.or would be dropped, matching nothing.)
      where: name
        ? { [Op.or]: [nameWhere, { operation: "HISTORY_REBUILD" }] }
        : {},
      order: [
        ["date", "ASC"],
        ["createdAt", "ASC"],
        ["Id", "ASC"],
      ],
      raw: true,
    }),
    InventoryMaster.findAll({
      where: nameWhere,
      paranoid: false,
      raw: true,
    }),
    DamageStock.findAll({ where: nameWhere, paranoid: false, raw: true }),
    DamageReparingStock.findAll({ where: nameWhere, paranoid: false, raw: true }),
  ]);
  // A live Stock Product row wins over a soft-deleted one for the same product.
  const purchasePriceByProductId = new Map();
  currentPriceRows
    .sort((a, b) => Number(!a.deletedAt) - Number(!b.deletedAt))
    .forEach((row) => {
      purchasePriceByProductId.set(Number(row.productId), n(row.purchase_price));
    });
  // FIFO averages are only a fallback for products without a Stock Product
  // row (see the PurchasePrice assignment below). Sourced from the movement
  // rows themselves so a soft-deleted product still gets priced.
  const productIds = [
    ...new Set(rows.map((row) => row.productId).filter(Boolean)),
  ];
  const [currentAvgPriceByProductId, lastKnownPriceByProductId] = await Promise.all([
    currentAverageProductCostMap(productIds),
    lastKnownProductUnitCostMap(productIds),
  ]);

  const map = new Map();

  const balances = collectStockBalances({ movements: rows, from, to, stocksByType: {
    ProductStock: currentPriceRows,
    DamageStock: damageRows,
    RepairingStock: repairingRows,
  } });
  balances.forEach((balance) => {
    const stockType = STOCK_MOVEMENT_TYPE_PREFIX[balance.type];
    if (!stockType) return;
    const pid = Number(balance.groupId);
    const key = String(pid);
    if (!map.has(key)) map.set(key, { productId: pid, productsName: balance.name });
    const entry = map.get(key);
    for (const [field, value] of Object.entries({ Opening: balance.opening,
      Closing: balance.closing, In: balance.in, Out: balance.out })) {
      entry[`${stockType}${field}`] = n(entry[`${stockType}${field}`]) + n(value);
    }
    const currentPrice = purchasePriceByProductId.has(pid)
      ? purchasePriceByProductId.get(pid)
      : currentAvgPriceByProductId.get(pid) || lastKnownPriceByProductId.get(pid) || 0;
    // Weighted-average costing: each date is valued at that day's average
    // (from the movement ledger); pools without one yet use the current price.
    entry[`${stockType}PurchasePrice`] = balance.closingAverage ?? currentPrice;
    entry[`${stockType}OpeningPurchasePrice`] = balance.openingAverage ?? currentPrice;
  });

  const all = Array.from(map.values())
    .map((row) => {
      const result = { productId: row.productId, productsName: row.productsName };
      STOCK_LEDGER_TYPES.forEach((stockType) => {
        const opening = n(row[`${stockType}Opening`]);
        const closing = n(row[`${stockType}Closing`]);
        const price = n(row[`${stockType}PurchasePrice`]);
        const openingPrice = n(row[`${stockType}OpeningPurchasePrice`] ?? price);
        result[`${stockType}Opening`] = opening;
        result[`${stockType}In`] = n(row[`${stockType}In`]);
        result[`${stockType}Out`] = n(row[`${stockType}Out`]);
        result[`${stockType}Closing`] = closing;
        result[`${stockType}PurchasePrice`] = price;
        result[`${stockType}OpeningPurchasePrice`] = openingPrice;
        result[`${stockType}OpeningPurchaseCost`] = opening * openingPrice;
        result[`${stockType}ClosingPurchaseCost`] = closing * price;
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

  const sumStockType = (stockType, field) =>
    all.reduce((sum, row) => sum + n(row[`${stockType}${field}`]), 0);
  const openingPurchaseCostByType = {};
  STOCK_LEDGER_TYPES.forEach((stockType) => {
    openingPurchaseCostByType[`${stockType}OpeningPurchaseCost`] = sumStockType(
      stockType,
      "OpeningPurchaseCost",
    );
  });
  const totalOpeningPurchaseCost = Object.values(
    openingPurchaseCostByType,
  ).reduce((sum, value) => sum + value, 0);

  return {
    meta: {
      from,
      to,
      name: name || null,
      count: all.length,
      ...openingPurchaseCostByType,
      totalOpeningPurchaseCost,
    },
    data: all,
  };
};

// Opening/Closing sibling of computeStockMovementLedgerReport, for stock pools
// grouped by whichever id field StockMovement was logged with for that pool
// (productId for Product/Damage/Repairing, itemId for everything else).
// `from` is optional: when given, each pool also gets an `${prefix}Opening`
// (balance at the end of the day before `from`); otherwise Opening is 0.
const computeStockMovementClosingReport = async ({
  from,
  to,
  name,
  groupIdField,
  stockTypeMap,
  priceByGroupIdByPrefix,
  stocksByType,
}) => {
  if (!to) {
    throw new ApiError(400, "to তারিখ দিতে হবে (YYYY-MM-DD)");
  }
  if (!StockMovement) return { meta: { to, count: 0 }, data: [] };

  const nameWhere = buildNameWhere(name);
  const stockTypeValues = Object.keys(stockTypeMap);
  if (stockTypeMap.ItemStock) stockTypeValues.push("PackagingStock");
  const rows = await StockMovement.findAll({
    where: {
      [Op.or]: [{ ...nameWhere,
        stockType: { [Op.in]: stockTypeValues } }, { operation: "HISTORY_REBUILD" }],
    },
    order: [
      ["date", "ASC"],
      ["createdAt", "ASC"],
      ["Id", "ASC"],
    ],
    raw: true,
  });

  const map = new Map();
  const balances = collectStockBalances({ movements: rows, stocksByType, from, to });
  balances.forEach((balance) => {
    const prefix = stockTypeMap[balance.type];
    if (!prefix) return;
    const key = String(balance.groupId);
    if (!map.has(key)) map.set(key, { groupId: balance.groupId, name: balance.name });
    const entry = map.get(key);
    entry[`${prefix}Closing`] = n(entry[`${prefix}Closing`]) + balance.closing;
    entry[`${prefix}Opening`] = n(entry[`${prefix}Opening`]) + balance.opening;
    // Weighted-average costing: value each stock row (manufacturer / variant)
    // at its own average on that day; rows without one use the group price.
    const groupPrice = (priceByGroupIdByPrefix[prefix] || new Map()).get(Number(balance.groupId)) || 0;
    entry[`${prefix}ClosingCost`] = n(entry[`${prefix}ClosingCost`]) + balance.closing * (balance.closingAverage ?? groupPrice);
    entry[`${prefix}OpeningCost`] = n(entry[`${prefix}OpeningCost`]) + balance.opening * (balance.openingAverage ?? groupPrice);
  });

  const prefixes = [...new Set(Object.values(stockTypeMap))];
  const all = Array.from(map.values())
    .map((row) => {
      const result = { groupId: row.groupId, name: row.name };
      prefixes.forEach((prefix) => {
        result[`${prefix}Opening`] = n(row[`${prefix}Opening`]);
        result[`${prefix}Closing`] = n(row[`${prefix}Closing`]);
        // Each pool prices off its OWN stock table — Factory Stock (held at a
        // manufacturer) is not the same balance as Item Stock (the central raw
        // pool), even though they share the same itemId, so they can (and often
        // do) carry different current unit costs.
        const groupPrice = (priceByGroupIdByPrefix[prefix] || new Map()).get(
          Number(row.groupId),
        ) || 0;
        result[`${prefix}ClosingCost`] = n(row[`${prefix}ClosingCost`]);
        result[`${prefix}OpeningCost`] = n(row[`${prefix}OpeningCost`]);
        // Shown price = the group's weighted average (total value ÷ quantity).
        result[`${prefix}PurchasePrice`] = result[`${prefix}Closing`] > 0
          ? result[`${prefix}ClosingCost`] / result[`${prefix}Closing`]
          : groupPrice;
      });
      return result;
    })
    .filter((row) =>
      prefixes.some(
        (prefix) =>
          n(row[`${prefix}Closing`]) > 0 || n(row[`${prefix}Opening`]) > 0,
      ),
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const purchaseCostByPrefix = {};
  const openingPurchaseCostByPrefix = {};
  prefixes.forEach((prefix) => {
    purchaseCostByPrefix[`${prefix}PurchaseCost`] = all.reduce(
      (sum, row) => sum + n(row[`${prefix}ClosingCost`]),
      0,
    );
    openingPurchaseCostByPrefix[`${prefix}OpeningPurchaseCost`] = all.reduce(
      (sum, row) => sum + n(row[`${prefix}OpeningCost`]),
      0,
    );
  });
  const totalPurchaseCost = Object.values(purchaseCostByPrefix).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalOpeningPurchaseCost = Object.values(
    openingPurchaseCostByPrefix,
  ).reduce((sum, value) => sum + value, 0);

  return {
    meta: {
      from: from || null,
      to,
      name: name || null,
      count: all.length,
      ...purchaseCostByPrefix,
      totalPurchaseCost,
      ...openingPurchaseCostByPrefix,
      totalOpeningPurchaseCost,
    },
    data: all,
  };
};

// `fallbackMap` covers ids whose live cost/unitValue computes to 0 (fully
// depleted right now) but which still have FIFO layer history — a
// stale-but-real reference price beats reporting ৳0 for a nonzero closing qty.
const buildUnitPriceMap = (rows, idField, fallbackMap = new Map()) => {
  const totals = new Map();
  rows.filter((row) => !row.deletedAt).forEach((row) => {
    const id = Number(row[idField]);
    if (!id) return;
    const total = totals.get(id) || { quantity: 0, cost: 0 };
    total.quantity += n(row.unitValue);
    total.cost += n(row.cost);
    totals.set(id, total);
  });
  const map = new Map();
  rows.forEach((row) => {
    const id = Number(row[idField]);
    if (!id) return;
    const total = totals.get(id);
    map.set(id, total?.quantity > 0 ? total.cost / total.quantity : fallbackMap.get(id) || 0);
  });
  return map;
};

// Item Stock (general raw-material pool) + Factory Stock (the same item,
// held against a specific manufacturer) — both keyed by itemId, but they're
// separate balances with their own cost, so each gets its own price map.
const computeItemFactoryStockReport = async ({ from, to, name } = {}) => {
  const [itemStockRows, factoryStockRows] = await Promise.all([
    ItemMaster.findAll({
      where: buildNameWhere(name),
      paranoid: false,
      raw: true,
    }),
    ManufactureStock.findAll({
      where: buildNameWhere(name),
      paranoid: false,
      raw: true,
    }),
  ]);
  const itemIds = itemStockRows.map((row) => row.itemId);
  const [itemStockFallback, factoryStockFallback] = await Promise.all([
    lastKnownItemUnitCostMap(itemIds),
    // Factory Stock has no FIFO layers of its own (it's a running weighted
    // average) — fall back to the raw item's purchase history, same as the
    // Factory Stock list page.
    buildItemUnitCostResolver(),
  ]);

  return computeStockMovementClosingReport({
    from,
    to,
    name,
    groupIdField: "itemId",
    stockTypeMap: { ItemStock: "itemStock", FactoryStock: "factoryStock" },
    stocksByType: { ItemStock: itemStockRows, FactoryStock: factoryStockRows },
    priceByGroupIdByPrefix: {
      itemStock: buildUnitPriceMap(itemStockRows, "itemId", itemStockFallback),
      factoryStock: buildUnitPriceMap(factoryStockRows, "itemId", new Map(
        factoryStockRows.map((row) => [Number(row.itemId), factoryStockFallback(Number(row.itemId), 0)]),
      )),
    },
  });
};

// Packaging Item Stock + Packaging Factory Stock — both keyed by
// packagingItemId (logged onto StockMovement.itemId), but separate balances
// with their own cost, so each gets its own price map.
const computePackagingStockReport = async ({ from, to, name } = {}) => {
  const [packagingItemStockRows, packagingFactoryStockRows] =
    await Promise.all([
      PackagingItemStock.findAll({
        where: buildNameWhere(name),
        paranoid: false,
        raw: true,
      }),
      PackagingFactoryStock.findAll({
        where: buildNameWhere(name),
        paranoid: false,
        raw: true,
      }),
    ]);
  const [packagingItemStockFallback, packagingFactoryStockFallback] =
    await Promise.all([
      lastKnownPackagingUnitCostMap(
        packagingItemStockRows.map((row) => row.packagingItemId),
      ),
      // Packaging Factory Stock has no FIFO layers of its own (running
      // weighted average) — fall back to the packaging item's purchase
      // history, same as the Packaging Factory Stock list page.
      buildPackagingUnitCostResolver(),
    ]);

  return computeStockMovementClosingReport({
    from,
    to,
    name,
    groupIdField: "itemId",
    stocksByType: { PackagingItemStock: packagingItemStockRows,
      PackagingFactoryStock: packagingFactoryStockRows },
    stockTypeMap: {
      PackagingItemStock: "packagingItemStock",
      PackagingFactoryStock: "packagingFactoryStock",
    },
    priceByGroupIdByPrefix: {
      packagingItemStock: buildUnitPriceMap(
        packagingItemStockRows,
        "packagingItemId",
        packagingItemStockFallback,
      ),
      packagingFactoryStock: buildUnitPriceMap(packagingFactoryStockRows, "packagingItemId", new Map(
        packagingFactoryStockRows.map((row) => [Number(row.packagingItemId), packagingFactoryStockFallback(Number(row.packagingItemId), 0)]),
      )),
    },
  });
};

// Every CashIn minus every CashOut up to a date boundary, restricted to rows
// actually linked to a real book (bookId not null). Some CashInOut rows
// (e.g. payroll-generated ones) are created without a bookId and so never
// show up under any book's own Total CashIn/Total CashOut widget — excluding
// them here keeps this figure consistent with what the Book page displays,
// rather than silently including money the Book page itself doesn't count.
const buildCashDateWhere = (op, value) => ({
  date: { [op]: value },
  deletedAt: { [Op.is]: null },
  bookId: { [Op.ne]: null },
});

const getCashBalance = async (dateWhere) => {
  if (!CashInOut) return 0;
  const [cashIn, cashOut] = await Promise.all([
    CashInOut.sum("amount", {
      where: { ...dateWhere, paymentStatus: "CashIn" },
    }),
    CashInOut.sum("amount", {
      where: { ...dateWhere, paymentStatus: "CashOut" },
    }),
  ]);
  return n(cashIn) - n(cashOut);
};

// Same figure as getCashBalance, split by payment mode (Cash / Bank / bKash /
// …) — company-wide (every book), not scoped to one book like
// monthlyReportingBook.service.js's own per-book paymentModeSummary.
// Restricted to paymentStatus CashIn/CashOut like getCashBalance's own sums —
// CashInOut also carries non-cash-movement rows (loan/supplier
// Due/Advance/Paid) that must not be netted in here. Rows with no
// paymentMode tagged are dropped rather than bucketed under a placeholder —
// they aren't a real payment mode to show as one.
const getCashBalanceByPaymentMode = async (dateWhere) => {
  if (!CashInOut) return [];
  const [cashRows, transferRows] = await Promise.all([CashInOut.findAll({
    where: { ...dateWhere, paymentStatus: { [Op.in]: ["CashIn", "CashOut"] } },
    attributes: [
      "paymentMode",
      "paymentStatus",
      [db.Sequelize.fn("SUM", db.Sequelize.col("amount")), "total"],
    ],
    group: ["paymentMode", "paymentStatus"],
    paranoid: true,
    raw: true,
  }), getFundTransferPaymentModeRows(dateWhere)]);
  const rows = [...cashRows, ...transferRows];

  const modeMap = {};
  rows.forEach((row) => {
    const mode = row.paymentMode && String(row.paymentMode).trim();
    if (!mode) return;
    const signed =
      String(row.paymentStatus || "").toLowerCase() === "cashin"
        ? n(row.total)
        : -n(row.total);
    modeMap[mode] = (modeMap[mode] || 0) + signed;
  });

  return Object.entries(modeMap).map(([mode, amount]) => ({ mode, amount }));
};

// Cash carried in from before `from` (the report's opening/carry-forward
// cutoff) and the mirroring "as of `to`" ending balance (the report's
// closing position) — same query, just the date boundary and comparison
// operator differ.
const getCashOpeningBalance = (from) =>
  from ? getCashBalance(buildCashDateWhere(Op.lt, from)) : Promise.resolve(0);

const getCashOpeningBalanceByPaymentMode = (from) =>
  from
    ? getCashBalanceByPaymentMode(buildCashDateWhere(Op.lt, from))
    : Promise.resolve([]);

const getCashEndingBalance = (to) =>
  to ? getCashBalance(buildCashDateWhere(Op.lte, to)) : Promise.resolve(0);

const getCashEndingBalanceByPaymentMode = (to) =>
  to
    ? getCashBalanceByPaymentMode(buildCashDateWhere(Op.lte, to))
    : Promise.resolve([]);

// Petty Cash carried in from before `from` — every Petty Cash CashIn minus
// every CashOut dated strictly before it. Its own "Total CashIn/Total
// CashOut/Net Balance" widget (pettyCash.service.js) doesn't restrict by
// bookId (only applies it when a specific book is filtered), so this
// mirrors that — no bookId condition here either.
const getPettyCashBalance = async (date, operator) => {
  if (!PettyCash || !date) return 0;
  const dateWhere = { date: { [operator]: date }, deletedAt: { [Op.is]: null } };
  const [cashIn, cashOut] = await Promise.all([
    PettyCash.sum("amount", {
      where: { ...dateWhere, paymentStatus: "CashIn" },
    }),
    PettyCash.sum("amount", {
      where: { ...dateWhere, paymentStatus: "CashOut" },
    }),
  ]);
  return n(cashIn) - n(cashOut);
};

const getPettyCashOpeningBalance = (from) => getPettyCashBalance(from, Op.lt);
const getPettyCashEndingBalance = (to) => getPettyCashBalance(to, Op.lte);

// DM balances follow the same dated cutoffs as the cash/stock statement.
const getDmBalance = async (date, operator) => {
  if (!date) return 0;
  const where = { date: { [operator]: date }, deletedAt: { [Op.is]: null } };
  const [cashIn, cashOut] = await Promise.all([
    db.marketingExpense.sum("amount", {
      where: { ...where, paymentStatus: "CashIn" },
    }),
    db.marketingExpense.sum("amount", {
      where: { ...where, paymentStatus: "CashOut" },
    }),
  ]);
  return n(cashIn) - n(cashOut);
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
    dollarSupplierReceivable,
    manufacturerReceivable,
    packagingManufacturerReceivable,
    lenderReceivable,
    salesDue,
    salaryAdvance,
    pendingPayrollSalary,
    supplierDue,
    dollarSupplierDue,
    manufacturerDue,
    packagingManufacturerDue,
    lenderPayable,
    directorInvestment,
    cashOpeningBalance,
    cashOpeningBalanceByPaymentMode,
    cashEndingBalance,
    cashEndingBalanceByPaymentMode,
    pettyCashOpeningBalance,
    pettyCashEndingBalance,
    dmOpeningBalance,
    dmEndingBalance,
  ] = await Promise.all([
    computeStockMovementLedgerReport({ from, to }),
    computeItemFactoryStockReport({ from, to }),
    computePackagingStockReport({ from, to }),
    getCourierProductStockReport({ from, to }),
    getSupplierReceivableReport({ from, to }),
    getDollarSupplierReceivableReport({ from, to }),
    getManufacturerReceivableReport({ from, to }),
    getPackagingManufacturerReceivableReport({ from, to }),
    getLenderReceivableReport({ from, to }),
    getSalesDueReport({ from, to }),
    getSalaryAdvanceReport({ from, to }),
    getPendingPayrollSalaryReport({ from, to }),
    getSupplierDueReport({ from, to }),
    getDollarSupplierDueReport({ from, to }),
    getManufacturerDueReport({ from, to }),
    getPackagingManufacturerDueReport({ from, to }),
    getLenderPayableReport({ from, to }),
    getDirectorInvestmentReport(),
    getCashOpeningBalance(from),
    getCashOpeningBalanceByPaymentMode(from),
    getCashEndingBalance(to),
    getCashEndingBalanceByPaymentMode(to),
    getPettyCashOpeningBalance(from),
    getPettyCashEndingBalance(to),
    getDmBalance(from, Op.lt),
    getDmBalance(to, Op.lte),
  ]);
  const rows = report.data || [];

  const sumStockType = (stockType, field) =>
    rows.reduce((sum, row) => sum + n(row[`${stockType}${field}`]), 0);

  return {
    meta: {
      count: report.meta?.count || rows.length,
      from: report.meta?.from || null,
      to: report.meta?.to || null,
      cashOpeningBalance,
      cashOpeningBalanceByPaymentMode,
      cashEndingBalance,
      cashEndingBalanceByPaymentMode,
      pettyCashOpeningBalance,
      pettyCashEndingBalance,
      dmOpeningBalance,
      dmEndingBalance,
      receivableOpeningBalance: [
        salesDue, salaryAdvance, supplierReceivable, dollarSupplierReceivable,
        manufacturerReceivable, packagingManufacturerReceivable, lenderReceivable,
      ].reduce((sum, entry) => sum + n(entry?.meta?.totalOpeningBalance), 0),
      payableOpeningBalance: [
        pendingPayrollSalary, manufacturerDue, packagingManufacturerDue,
        supplierDue, dollarSupplierDue, lenderPayable,
      ].reduce((sum, entry) => sum + n(entry?.meta?.totalOpeningBalance), 0),
      receivableEndingBalance: [
        salesDue, salaryAdvance, supplierReceivable, dollarSupplierReceivable,
        manufacturerReceivable, packagingManufacturerReceivable, lenderReceivable,
      ].reduce((sum, entry) => sum + n(entry?.meta?.totalEndingBalance), 0),
      payableEndingBalance: [
        pendingPayrollSalary, manufacturerDue, packagingManufacturerDue,
        supplierDue, dollarSupplierDue, lenderPayable,
      ].reduce((sum, entry) => sum + n(entry?.meta?.totalEndingBalance), 0),
      totalStockProduct: sumStockType("stockProduct", "Closing"),
      totalDamageStock: sumStockType("damageStock", "Closing"),
      totalRepairingStock: sumStockType("repairingStock", "Closing"),
      totalProducts:
        sumStockType("stockProduct", "Closing") +
        sumStockType("damageStock", "Closing") +
        sumStockType("repairingStock", "Closing"),
      stockProductPurchaseCost: sumStockType(
        "stockProduct",
        "ClosingPurchaseCost",
      ),
      damageStockPurchaseCost: sumStockType("damageStock", "ClosingPurchaseCost"),
      repairingStockPurchaseCost: sumStockType(
        "repairingStock",
        "ClosingPurchaseCost",
      ),
      totalPurchaseCost:
        sumStockType("stockProduct", "ClosingPurchaseCost") +
        sumStockType("damageStock", "ClosingPurchaseCost") +
        sumStockType("repairingStock", "ClosingPurchaseCost"),
      stockProductOpeningPurchaseCost: sumStockType(
        "stockProduct",
        "OpeningPurchaseCost",
      ),
      damageStockOpeningPurchaseCost: sumStockType(
        "damageStock",
        "OpeningPurchaseCost",
      ),
      repairingStockOpeningPurchaseCost: sumStockType(
        "repairingStock",
        "OpeningPurchaseCost",
      ),
      totalOpeningPurchaseCost:
        sumStockType("stockProduct", "OpeningPurchaseCost") +
        sumStockType("damageStock", "OpeningPurchaseCost") +
        sumStockType("repairingStock", "OpeningPurchaseCost"),
    },
    data: rows,
    itemFactoryStock,
    packagingStock,
    courierProductStock,
    supplierReceivable,
    dollarSupplierReceivable,
    manufacturerReceivable,
    packagingManufacturerReceivable,
    lenderReceivable,
    salesDue,
    salaryAdvance,
    pendingPayrollSalary,
    supplierDue,
    dollarSupplierDue,
    manufacturerDue,
    packagingManufacturerDue,
    lenderPayable,
    directorInvestment,
  };
};

const attachRowUnitPricing = (rows, priceByName) =>
  rows.map((row) => {
    const stockPrice = getStockPriceForRow(priceByName, row);
    const qty = n(row.quantity);
    const frozenSale = FROZEN_MONEY_SOURCES.has(row.source);

    return {
      ...row,
      purchase_price: stockPrice.purchase_price,
      unitPurchasePrice: stockPrice.purchase_price,
      unitSalePrice:
        frozenSale && qty > 0
          ? rowSaleValue(row, priceByName) / qty
          : stockPrice.sale_price,
      // This movement's own variant/quantity split (e.g. which batches went
      // into this specific Intransit entry) — parsed since it can arrive as
      // a raw JSON string rather than an already-decoded array. Shown for
      // reference only; pricing for these is the same flat Stock Product
      // price as the row, not tracked per variant.
      variants: parseRowVariants(row).map((variant) => ({
        ...variant,
        purchase_price: stockPrice.purchase_price,
      })),
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

// app/modules/overview/overview.service.js

const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  getInventoryDisplayQuantity,
  getInventoryStockBalance,
} = require("../../../shared/variantQuantity");

const Receiveable = db.receiveable;
const Payable = db.payable;
const PurchaseRequisition = db.purchaseRequisition;
const PettyCashRequisition = db.pettyCashRequisition;
const AssetsRequisition = db.assetsRequisition;
const DamageStock = db.damageStock;
const DamageReparingStock = db.damageReparingStock;
const AssetsStock = db.assetsStock;
const CashInOut = db.cashInOut;
const Product = db.product;
const InventoryMaster = db.inventoryMaster;
const ConfirmOrder = db.confirmOrder;
const MarketingExpense = db.marketingExpense;
const IntransitProduct = db.inTransitProduct;
const ReturnProduct = db.returnProduct;
const CodCharge = db.codCharge;
const CodChange = db.codChange;
const DeliveryCharge = db.deliveryCharge;
const DeliveryAdvance = db.deliveryAdvance;
const UserLogHistory = db.userLogHistory;

// ✅ helper: safe number
const n = (v) => Number(v || 0);

const activeWhere = (Model, where = {}) => {
  if (!Model?.rawAttributes?.deletedAt || where.deletedAt) return where;

  return {
    ...where,
    deletedAt: { [Op.is]: null },
  };
};

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isTruthyFilterFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;

  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
};

const normalizeDateFilters = (filters = {}) => {
  const filterType =
    filters.filterType || filters.filter || filters.preset || null;
  const normalizedFilterType = filterType
    ? String(filterType).trim().toLowerCase()
    : null;
  const date = filters.date || null;
  const customFrom = filters.from || filters.startDate || null;
  const customTo = filters.to || filters.endDate || null;
  const explicitFilterRequested =
    normalizedFilterType === "today" ||
    normalizedFilterType === "thismonth" ||
    normalizedFilterType === "this_month" ||
    normalizedFilterType === "custom" ||
    isTruthyFilterFlag(filters.applyFilter) ||
    isTruthyFilterFlag(filters.hasDateFilter) ||
    isTruthyFilterFlag(filters.isFiltered);

  let from = null;
  let to = null;

  if (normalizedFilterType === "today") {
    const today = formatDateOnly(new Date());
    from = today;
    to = today;
  }

  if (
    normalizedFilterType === "thismonth" ||
    normalizedFilterType === "this_month"
  ) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    from = formatDateOnly(firstDay);
    to = formatDateOnly(lastDay);
  }

  if (date && explicitFilterRequested) {
    return {
      from: date,
      to: date,
      filterType: normalizedFilterType || "custom",
    };
  }

  if (
    explicitFilterRequested &&
    normalizedFilterType !== "today" &&
    normalizedFilterType !== "thismonth" &&
    normalizedFilterType !== "this_month"
  ) {
    from = customFrom;
    to = customTo;
  }

  return {
    from,
    to,
    filterType: from || to ? normalizedFilterType || "custom" : null,
  };
};

const normalizeDateValue = (value) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD");
  }

  return parsed.toISOString().slice(0, 10);
};

const parseBoundaryDateTime = (value, edge) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD");
  }

  if (edge === "start") {
    parsed.setHours(0, 0, 0, 0);
  } else {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
};

// ✅ helper: date range where builder
const buildDateWhere = (from, to, field = "createdAt") => {
  if (!from && !to) return {};

  const isDateOnlyField = field === "date";

  if (from && to) {
    return {
      [field]: {
        [Op.between]: isDateOnlyField
          ? [normalizeDateValue(from), normalizeDateValue(to)]
          : [
              parseBoundaryDateTime(from, "start"),
              parseBoundaryDateTime(to, "end"),
            ],
      },
    };
  }

  if (from) {
    return {
      [field]: {
        [Op.gte]: isDateOnlyField
          ? normalizeDateValue(from)
          : parseBoundaryDateTime(from, "start"),
      },
    };
  }

  return {
    [field]: {
      [Op.lte]: isDateOnlyField
        ? normalizeDateValue(to)
        : parseBoundaryDateTime(to, "end"),
    },
  };
};

const getDefaultDateRange = () => {
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(toDate.getDate() - 29);

  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
  };
};

const getDashboardDateFilters = (filters = {}) => {
  const normalized = normalizeDateFilters({
    ...filters,
    applyFilter: true,
  });

  if (normalized.from || normalized.to) {
    const defaults = getDefaultDateRange();

    return {
      ...normalized,
      from: normalized.from || defaults.from,
      to: normalized.to || defaults.to,
      filterType: normalized.filterType || "custom",
    };
  }

  return {
    ...getDefaultDateRange(),
    filterType: "last_30_days",
  };
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getInclusiveDayCount = (from, to) => {
  const fromDate = parseBoundaryDateTime(from, "start");
  const toDate = parseBoundaryDateTime(to, "start");
  const diff = toDate.getTime() - fromDate.getTime();

  return Math.max(Math.floor(diff / (24 * 60 * 60 * 1000)) + 1, 1);
};

const getPreviousDateRange = (from, to) => {
  const days = getInclusiveDayCount(from, to);
  const currentFrom = parseBoundaryDateTime(from, "start");
  const previousTo = addDays(currentFrom, -1);
  const previousFrom = addDays(previousTo, -(days - 1));

  return {
    from: formatDateOnly(previousFrom),
    to: formatDateOnly(previousTo),
  };
};

const enumerateDates = (from, to) => {
  const dates = [];
  const cursor = parseBoundaryDateTime(from, "start");
  const end = parseBoundaryDateTime(to, "start");

  while (cursor <= end) {
    dates.push(formatDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const calculateChangePercent = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const makeMetric = (value, previousValue = 0) => ({
  value: n(value),
  previousValue: n(previousValue),
  changePercent: calculateChangePercent(n(value), n(previousValue)),
});

const sumField = async (Model, field, where = {}) => {
  if (!Model) return 0;
  const total = await Model.sum(field, {
    where: activeWhere(Model, where),
    paranoid: true,
  });
  return n(total);
};

const sumExcludedCashOutAmount = async (where = {}) => {
  const total = await CashInOut.sum("amount", {
    where: activeWhere(CashInOut, {
      ...where,
      paymentStatus: "CashOut",
      [Op.and]: [
        db.Sequelize.literal(
          "LOWER(category) IN ('loan', 'advance', 'product purchase')",
        ),
      ],
    }),
    paranoid: true,
  });

  return n(total);
};

const countWhere = async (Model, where = {}) => {
  if (!Model) return 0;
  return n(
    await Model.count({
      where: activeWhere(Model, where),
      paranoid: true,
    }),
  );
};

const sumQuantityValue = async (
  Model,
  where = {},
  priceField = "purchase_price",
) => {
  if (!Model) return 0;

  const result = await Model.findOne({
    where: activeWhere(Model, where),
    paranoid: true,
    attributes: [
      [
        db.Sequelize.fn(
          "COALESCE",
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(`quantity * ${priceField}`),
          ),
          0,
        ),
        "totalValue",
      ],
    ],
    raw: true,
  });

  return n(result?.totalValue);
};

const sumInventoryDisplayQuantityValue = async (
  Model,
  where = {},
  priceField = "purchase_price",
) => {
  if (!Model) return 0;

  const rows = await Model.findAll({
    where: activeWhere(Model, where),
    paranoid: true,
    attributes: ["quantity", "variants", priceField],
  });

  return rows.reduce(
    (total, row) =>
      total +
      (priceField === "purchase_price"
        ? getInventoryStockBalance(row)
        : n(getInventoryDisplayQuantity(row)) * n(row[priceField])),
    0,
  );
};

const sumDisplayQuantity = async (Model, where = {}) => {
  if (!Model) return 0;

  const rows = await Model.findAll({
    where: activeWhere(Model, where),
    paranoid: true,
    attributes: ["quantity", "variants"],
  });

  return rows.reduce(
    (total, row) => total + n(getInventoryDisplayQuantity(row)),
    0,
  );
};

const getProductKey = (row) =>
  String(row?.productId ?? row?.receivedId ?? row?.name ?? row?.Id ?? "");

const calculateNetPurchaseFromProductRows = async (where = {}) => {
  const [inTransitRows, returnRows] = await Promise.all([
    IntransitProduct.findAll({
      where: activeWhere(IntransitProduct, where),
      attributes: ["Id", "name", "productId", "quantity", "purchase_price"],
      paranoid: true,
      raw: true,
    }),
    ReturnProduct.findAll({
      where: activeWhere(ReturnProduct, where),
      attributes: ["Id", "name", "productId", "quantity"],
      paranoid: true,
      raw: true,
    }),
  ]);

  const productMap = new Map();

  inTransitRows.forEach((row) => {
    const key = getProductKey(row);
    if (!key) return;

    const current = productMap.get(key) || {
      inTransitQty: 0,
      inTransitPurchase: 0,
      returnQty: 0,
    };

    current.inTransitQty += n(row.quantity);
    current.inTransitPurchase += n(row.purchase_price);
    productMap.set(key, current);
  });

  returnRows.forEach((row) => {
    const key = getProductKey(row);
    if (!key) return;

    const current = productMap.get(key) || {
      inTransitQty: 0,
      inTransitPurchase: 0,
      returnQty: 0,
    };

    current.returnQty += n(row.quantity);
    productMap.set(key, current);
  });

  return Array.from(productMap.values()).reduce((total, item) => {
    if (item.inTransitQty <= 0) return total;

    const remainingQty = Math.max(item.inTransitQty - item.returnQty, 0);
    const purchasePricePerUnit = item.inTransitPurchase / item.inTransitQty;

    return total + remainingQty * purchasePricePerUnit;
  }, 0);
};

const countLowStockProducts = async (where = {}) => {
  const rows = await InventoryMaster.findAll({
    where: activeWhere(InventoryMaster, where),
    attributes: ["quantity", "variants", "minimumStock"],
    paranoid: true,
  });

  return rows.filter(
    (row) => n(getInventoryDisplayQuantity(row)) <= n(row.minimumStock),
  ).length;
};

const getSalesTotals = async (where = {}) => {
  const [revenue, orders] = await Promise.all([
    sumField(ConfirmOrder, "sale_price", where),
    countWhere(ConfirmOrder, where),
  ]);

  return { revenue, orders };
};

const getSalesRowsByDate = async (from, to) => {
  const rows = await ConfirmOrder.findAll({
    where: activeWhere(ConfirmOrder, buildDateWhere(from, to, "date")),
    attributes: [
      "date",
      [db.Sequelize.fn("COALESCE", db.Sequelize.fn("SUM", db.Sequelize.col("sale_price")), 0), "revenue"],
      [db.Sequelize.fn("COALESCE", db.Sequelize.fn("SUM", db.Sequelize.col("quantity")), 0), "quantity"],
      [db.Sequelize.fn("COUNT", db.Sequelize.col("Id")), "orders"],
    ],
    group: ["date"],
    order: [["date", "ASC"]],
    paranoid: true,
    raw: true,
  });

  return rows.reduce((acc, row) => {
    acc[row.date] = {
      revenue: n(row.revenue),
      quantity: n(row.quantity),
      orders: n(row.orders),
    };
    return acc;
  }, {});
};

const getSalesOverviewChart = async (from, to) => {
  const previousRange = getPreviousDateRange(from, to);
  const [currentRows, previousRows] = await Promise.all([
    getSalesRowsByDate(from, to),
    getSalesRowsByDate(previousRange.from, previousRange.to),
  ]);
  const currentDates = enumerateDates(from, to);
  const previousDates = enumerateDates(previousRange.from, previousRange.to);

  return currentDates.map((date, index) => {
    const previousDate = previousDates[index] || null;

    return {
      date,
      previousDate,
      currentRevenue: n(currentRows[date]?.revenue),
      previousRevenue: previousDate ? n(previousRows[previousDate]?.revenue) : 0,
      currentOrders: n(currentRows[date]?.orders),
      previousOrders: previousDate ? n(previousRows[previousDate]?.orders) : 0,
      currentQuantity: n(currentRows[date]?.quantity),
      previousQuantity: previousDate ? n(previousRows[previousDate]?.quantity) : 0,
    };
  });
};

const getInventoryRows = async () =>
  InventoryMaster.findAll({
    where: activeWhere(InventoryMaster, {}),
    attributes: [
      "Id",
      "name",
      "sku",
      "quantity",
      "minimumStock",
      "variants",
      "purchase_price",
      "sale_price",
    ],
    order: [["name", "ASC"]],
    paranoid: true,
  });

const getInventorySnapshot = async () => {
  const [inventoryRows, damageStockQuantity, repairingStockQuantity] =
    await Promise.all([
      getInventoryRows(),
      sumDisplayQuantity(DamageStock, {}),
      sumDisplayQuantity(DamageReparingStock, {}),
    ]);

  const products = inventoryRows.map((row) => {
    const plain = typeof row?.get === "function" ? row.get({ plain: true }) : row;
    const currentStock = n(getInventoryDisplayQuantity(plain));
    const minimumStock = n(plain.minimumStock);

    return {
      id: plain.Id,
      name: plain.name,
      sku: plain.sku || "",
      currentStock,
      minimumStock,
      stockValue: currentStock * n(plain.sale_price),
    };
  });

  const inStockProducts = products.filter(
    (product) => product.currentStock > product.minimumStock,
  );
  const lowStockProducts = products.filter(
    (product) =>
      product.currentStock > 0 && product.currentStock <= product.minimumStock,
  );
  const outOfStockProducts = products.filter(
    (product) => product.currentStock <= 0,
  );

  return {
    totalItems: products.reduce((total, product) => total + product.currentStock, 0),
    totalProducts: products.length,
    inStock: {
      count: inStockProducts.length,
      quantity: inStockProducts.reduce((total, product) => total + product.currentStock, 0),
    },
    lowStock: {
      count: lowStockProducts.length,
      quantity: lowStockProducts.reduce((total, product) => total + product.currentStock, 0),
    },
    outOfStock: {
      count: outOfStockProducts.length,
      quantity: 0,
    },
    damaged: {
      count: n(damageStockQuantity),
      quantity: n(damageStockQuantity),
    },
    repairing: {
      count: n(repairingStockQuantity),
      quantity: n(repairingStockQuantity),
    },
    lowStockProducts: lowStockProducts
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 10),
  };
};

const getTopSellingProducts = async (where = {}, limit = 5) => {
  const rows = await ConfirmOrder.findAll({
    where: activeWhere(ConfirmOrder, where),
    attributes: [
      "name",
      [db.Sequelize.fn("COALESCE", db.Sequelize.fn("SUM", db.Sequelize.col("quantity")), 0), "soldQty"],
      [db.Sequelize.fn("COALESCE", db.Sequelize.fn("SUM", db.Sequelize.col("sale_price")), 0), "revenue"],
    ],
    group: ["name"],
    order: [[db.Sequelize.literal("revenue"), "DESC"]],
    limit,
    paranoid: true,
    raw: true,
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    productName: row.name,
    soldQty: n(row.soldQty),
    revenue: n(row.revenue),
  }));
};

const getRecentSales = async (where = {}, limit = 5) => {
  const rows = await ConfirmOrder.findAll({
    where: activeWhere(ConfirmOrder, where),
    attributes: ["Id", "name", "sale_price", "quantity", "date", "createdAt"],
    order: [["createdAt", "DESC"]],
    limit,
    paranoid: true,
    raw: true,
  });

  return rows.map((row) => ({
    orderId: `#ORD-${String(row.Id).padStart(5, "0")}`,
    productName: row.name,
    customer: null,
    amount: n(row.sale_price),
    quantity: n(row.quantity),
    status: "Completed",
    date: row.date,
    createdAt: row.createdAt,
  }));
};

const getRecentActivities = async (limit = 5) => {
  if (!UserLogHistory) return [];

  const rows = await UserLogHistory.findAll({
    where: activeWhere(UserLogHistory, {}),
    attributes: [
      "Id",
      "action",
      "module",
      "method",
      "route",
      "status",
      "statusCode",
      "userEmail",
      "userRole",
      "responseMessage",
      "createdAt",
    ],
    order: [["createdAt", "DESC"]],
    limit,
    paranoid: true,
    raw: true,
  });

  return rows.map((row) => ({
    id: row.Id,
    action: row.action,
    module: row.module,
    method: row.method,
    route: row.route,
    status: row.status,
    statusCode: row.statusCode,
    userEmail: row.userEmail,
    userRole: row.userRole,
    message: row.responseMessage,
    createdAt: row.createdAt,
  }));
};

const getOverviewSummaryFromDB = async (filters = {}) => {
  const { from, to, filterType } = normalizeDateFilters(filters);
  const transactionDateWhere = buildDateWhere(from, to, "date");
  const snapshotWhere = {};

  const [
    totalMetaAmount,
    totalAssetsBalance,
    totalReceiveableAmount,
    totalPayableAmount,
    totalInventoryOverview,
    totalInventoryQuantity,
    totalInventoryRetailValue,
    totalDamageStockPrice,
    totalDamageStockQuantity,
    totalRepairingStockPrice,
    totalRepairingStockQuantity,
    totalCashInAmount,
    totalCashOutAmount,
    excludedCashOutAmount,
    grossSalesAmount,
    inTransitSalesAmount,
    salesReturnSalesAmount,
    inTransitPurchaseAmount,
    salesReturnPurchaseAmount,
    totalCodCharge,
    totalCodChange,
    totalDeliveryCharge,
    totalDeliveryAdvance,
    lowStockCount,
    pendingPurchaseRequisitionCount,
    pendingPettyCashRequisitionCount,
    pendingAssetsRequisitionCount,
  ] = await Promise.all([
    sumField(MarketingExpense, "amount", {
      ...transactionDateWhere,
      paymentStatus: "CashOut",
    }),
    sumQuantityValue(AssetsStock, {}, "price"),
    sumField(Receiveable, "amount", transactionDateWhere),
    sumField(Payable, "amount", transactionDateWhere),
    sumInventoryDisplayQuantityValue(
      InventoryMaster,
      snapshotWhere,
      "purchase_price",
    ),
    sumDisplayQuantity(InventoryMaster, snapshotWhere),
    sumInventoryDisplayQuantityValue(InventoryMaster, snapshotWhere, "sale_price"),
    sumField(DamageStock, "purchase_price", snapshotWhere),
    sumDisplayQuantity(DamageStock, snapshotWhere),
    sumField(DamageReparingStock, "purchase_price", snapshotWhere),
    sumDisplayQuantity(DamageReparingStock, snapshotWhere),
    sumField(CashInOut, "amount", {
      ...transactionDateWhere,
      paymentStatus: "CashIn",
    }),
    sumField(CashInOut, "amount", {
      ...transactionDateWhere,
      paymentStatus: "CashOut",
    }),
    sumExcludedCashOutAmount(transactionDateWhere),
    sumField(ConfirmOrder, "sale_price", transactionDateWhere),
    sumField(IntransitProduct, "sale_price", transactionDateWhere),
    sumField(ReturnProduct, "sale_price", transactionDateWhere),
    sumField(IntransitProduct, "purchase_price", transactionDateWhere),
    sumField(ReturnProduct, "purchase_price", transactionDateWhere),
    sumField(CodCharge, "amount", transactionDateWhere),
    sumField(CodChange, "amount", transactionDateWhere),
    sumField(DeliveryCharge, "amount", transactionDateWhere),
    sumField(DeliveryAdvance, "amount", transactionDateWhere),
    countLowStockProducts(snapshotWhere),
    countWhere(PurchaseRequisition, {
      ...transactionDateWhere,
      status: "Pending",
    }),
    countWhere(PettyCashRequisition, {
      ...transactionDateWhere,
      status: "Pending",
    }),
    countWhere(AssetsRequisition, {
      ...transactionDateWhere,
      status: "Pending",
    }),
  ]);

  const netCashPosition = n(totalCashInAmount - totalCashOutAmount);
  const netSalesBeforeCharges = n(
    inTransitSalesAmount - salesReturnSalesAmount,
  );
  const othersExpense = Math.max(
    n(totalCashOutAmount - excludedCashOutAmount),
    0,
  );
  const netRevenue = n(
    netSalesBeforeCharges -
      n(totalCodCharge) -
      n(totalCodChange) -
      n(totalDeliveryCharge) +
      n(totalDeliveryAdvance),
  );
  const netPurchase = n(inTransitPurchaseAmount - salesReturnPurchaseAmount);
  const grossProfit = n(netRevenue - netPurchase);
  const netProfitLoss = n(grossProfit - othersExpense);
  const totalPendingApprovalCount = n(
    pendingPurchaseRequisitionCount +
      pendingPettyCashRequisitionCount +
      pendingAssetsRequisitionCount,
  );

  return {
    filterType,
    from: from || null,
    to: to || null,
    totalMetaAmount,
    totalAssetsBalance,
    totalReceiveableAmount,
    totalPayableAmount,
    totalInventoryOverview,
    totalInventoryQuantity,
    totalInventoryRetailValue,
    totalDamageStockPrice,
    totalDamageStockQuantity,
    totalRepairingStockPrice,
    totalRepairingStockQuantity,
    grossSalesAmount,
    inTransitSalesAmount,
    salesReturnSalesAmount,
    inTransitPurchaseAmount,
    salesReturnPurchaseAmount,
    totalCodCharge,
    totalCodChange,
    totalDeliveryCharge,
    totalDeliveryAdvance,
    netSalesBeforeCharges,
    netRevenue,
    netPurchase,
    grossProfit,
    othersExpense,
    netProfitLoss,
    totalCashInAmount,
    totalCashOutAmount,
    netCashPosition,
    lowStockCount,
    pendingPurchaseRequisitionCount,
    pendingPettyCashRequisitionCount,
    pendingAssetsRequisitionCount,
    totalPendingApprovalCount,
  };
};

const makeSnapshotMetric = (value) => ({
  value: n(value),
  previousValue: null,
  changePercent: null,
});

const getOverviewDashboardFromDB = async (filters = {}) => {
  const { from, to, filterType } = getDashboardDateFilters(filters);
  const previousRange = getPreviousDateRange(from, to);
  const currentDateWhere = buildDateWhere(from, to, "date");
  const previousDateWhere = buildDateWhere(
    previousRange.from,
    previousRange.to,
    "date",
  );
  const productCreatedAtWhere = buildDateWhere(from, to, "createdAt");
  const previousProductCreatedAtWhere = buildDateWhere(
    previousRange.from,
    previousRange.to,
    "createdAt",
  );

  const [
    currentSummary,
    previousSummary,
    currentSales,
    previousSales,
    totalProductCount,
    currentProductCreatedCount,
    previousProductCreatedCount,
    inventorySnapshot,
    salesOverview,
    topSellingProducts,
    recentSales,
    recentActivities,
  ] = await Promise.all([
    getOverviewSummaryFromDB({ from, to, applyFilter: true }),
    getOverviewSummaryFromDB({
      from: previousRange.from,
      to: previousRange.to,
      applyFilter: true,
    }),
    getSalesTotals(currentDateWhere),
    getSalesTotals(previousDateWhere),
    countWhere(Product, {}),
    countWhere(Product, productCreatedAtWhere),
    countWhere(Product, previousProductCreatedAtWhere),
    getInventorySnapshot(),
    getSalesOverviewChart(from, to),
    getTopSellingProducts(currentDateWhere, 5),
    getRecentSales(currentDateWhere, 5),
    getRecentActivities(5),
  ]);

  return {
    filterType,
    from,
    to,
    previousFrom: previousRange.from,
    previousTo: previousRange.to,
    metrics: {
      totalRevenue: makeMetric(
        currentSummary.netRevenue,
        previousSummary.netRevenue,
      ),
      totalSales: makeMetric(currentSales.revenue, previousSales.revenue),
      totalOrders: makeMetric(currentSales.orders, previousSales.orders),
      totalProducts: {
        ...makeSnapshotMetric(totalProductCount),
        periodValue: n(currentProductCreatedCount),
        previousPeriodValue: n(previousProductCreatedCount),
        periodChangePercent: calculateChangePercent(
          n(currentProductCreatedCount),
          n(previousProductCreatedCount),
        ),
      },
      lowStockItems: makeSnapshotMetric(inventorySnapshot.lowStock.count),
      stockValue: makeSnapshotMetric(currentSummary.totalInventoryRetailValue),
    },
    salesOverview,
    inventorySummary: {
      totalItems: inventorySnapshot.totalItems,
      totalProducts: inventorySnapshot.totalProducts,
      inStock: inventorySnapshot.inStock,
      lowStock: inventorySnapshot.lowStock,
      outOfStock: inventorySnapshot.outOfStock,
      damaged: inventorySnapshot.damaged,
      repairing: inventorySnapshot.repairing,
    },
    lowStockProducts: inventorySnapshot.lowStockProducts,
    topSellingProducts,
    recentSales,
    recentActivities,
    summary: currentSummary,
  };
};

const OverviewService = {
  getOverviewSummaryFromDB,
  getOverviewDashboardFromDB,
};

module.exports = OverviewService;

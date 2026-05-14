// app/modules/overview/overview.service.js

const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  getInventoryDisplayQuantity,
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
const InventoryMaster = db.inventoryMaster;
const ConfirmOrder = db.confirmOrder;
const MarketingExpense = db.marketingExpense;
const IntransitProduct = db.inTransitProduct;
const ReturnProduct = db.returnProduct;
const CodCharge = db.codCharge;
const CodChange = db.codChange;
const DeliveryCharge = db.deliveryCharge;
const DeliveryAdvance = db.deliveryAdvance;

// ✅ helper: safe number
const n = (v) => Number(v || 0);

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

const sumField = async (Model, field, where = {}) => {
  if (!Model) return 0;
  const total = await Model.sum(field, {
    where,
    paranoid: true,
  });
  return n(total);
};

const sumExcludedCashOutAmount = async (where = {}) => {
  const total = await CashInOut.sum("amount", {
    where: {
      ...where,
      paymentStatus: "CashOut",
      [Op.and]: [
        db.Sequelize.literal(
          "LOWER(category) IN ('loan', 'advance', 'product purchase')",
        ),
      ],
    },
    paranoid: true,
  });

  return n(total);
};

const countWhere = async (Model, where = {}) => {
  if (!Model) return 0;
  return n(
    await Model.count({
      where,
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
    where,
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

const getProductKey = (row) =>
  String(row?.productId ?? row?.receivedId ?? row?.name ?? row?.Id ?? "");

const calculateNetPurchaseFromProductRows = async (where = {}) => {
  const [inTransitRows, returnRows] = await Promise.all([
    IntransitProduct.findAll({
      where,
      attributes: ["Id", "name", "productId", "quantity", "purchase_price"],
      paranoid: true,
      raw: true,
    }),
    ReturnProduct.findAll({
      where,
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
    where,
    attributes: ["quantity", "variants", "minimumStock"],
    paranoid: true,
  });

  return rows.filter(
    (row) => n(getInventoryDisplayQuantity(row)) <= n(row.minimumStock),
  ).length;
};

const getOverviewSummaryFromDB = async (filters = {}) => {
  const { from, to, filterType } = normalizeDateFilters(filters);
  const transactionDateWhere = buildDateWhere(from, to, "date");
  const snapshotWhere = buildDateWhere(from, to, "createdAt");

  const [
    totalMetaAmount,
    totalAssetsBalance,
    totalReceiveableAmount,
    totalPayableAmount,
    totalInventoryOverview,
    totalInventoryRetailValue,
    totalDamageStockPrice,
    totalRepairingStockPrice,
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
    sumQuantityValue(AssetsStock, snapshotWhere, "price"),
    sumField(Receiveable, "amount", transactionDateWhere),
    sumField(Payable, "amount", transactionDateWhere),
    sumQuantityValue(InventoryMaster, snapshotWhere, "purchase_price"),
    sumQuantityValue(InventoryMaster, snapshotWhere, "sale_price"),
    sumField(DamageStock, "purchase_price", transactionDateWhere),
    sumField(DamageReparingStock, "purchase_price", transactionDateWhere),
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
    totalInventoryRetailValue,
    totalDamageStockPrice,
    totalRepairingStockPrice,
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

const OverviewService = {
  getOverviewSummaryFromDB,
};

module.exports = OverviewService;

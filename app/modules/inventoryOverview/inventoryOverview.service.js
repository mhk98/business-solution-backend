const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

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

const n = (v) => Number(v || 0);

const overviewSources = [
  {
    key: "totalReceivedProduct",
    label: "Received Product",
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
    label: "Purchase Return Product",
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
    label: "In Transit Product",
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
    label: "Sales Return Product",
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
    label: "Confirm Order",
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
    ({ label, key }) =>
      label.toLowerCase() === normalizedSource ||
      key.toLowerCase() === normalizedSource,
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
    variants: r.variants || [],
    date: r.date,
    createdAt: r.createdAt,
  }));
};

const parseRowVariants = (row) => {
  if (Array.isArray(row.variants)) return row.variants;
  try { return JSON.parse(row.variants || "[]"); } catch { return []; }
};

// ReceivedProduct stores unit prices (purchase_price = unit price, must × quantity).
// All other sources store pre-computed totals in purchase_price/sale_price.
const SOURCE_STORES_UNIT_PRICE = "Received Product";

const calcRowPurchaseValue = (row) => {
  const variants = parseRowVariants(row);

  if (variants.length) {
    const hasVariantPrices = variants.some((v) => n(v?.purchase_price) > 0);
    if (hasVariantPrices) {
      // Variants carry unit prices (ReceivedProduct style)
      return variants.reduce((sum, v) => sum + n(v?.quantity) * n(v?.purchase_price), 0);
    }
    // Variants have no prices → row.purchase_price is already the total
    return n(row.purchase_price);
  }

  if (row.source === SOURCE_STORES_UNIT_PRICE) {
    return n(row.quantity) * n(row.purchase_price);
  }
  // All other sources store total in purchase_price
  return n(row.purchase_price);
};

const calcRowSaleValue = (row) => {
  const variants = parseRowVariants(row);

  if (variants.length) {
    const hasVariantPrices = variants.some((v) => n(v?.sale_price) > 0);
    if (hasVariantPrices) {
      return variants.reduce((sum, v) => sum + n(v?.quantity) * n(v?.sale_price), 0);
    }
    return n(row.sale_price);
  }

  if (row.source === SOURCE_STORES_UNIT_PRICE) {
    return n(row.quantity) * n(row.sale_price);
  }
  return n(row.sale_price);
};

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
  const totalQuantity = all.reduce((sum, row) => sum + n(row.quantity), 0);
  const totalPurchaseValue = all.reduce((sum, row) => sum + calcRowPurchaseValue(row), 0);
  const totalSaleValue = all.reduce((sum, row) => sum + calcRowSaleValue(row), 0);

  const paged = all.slice(skip, skip + limit);

  return {
    meta: {
      from: from || null,
      to: to || null,
      name: name || null,
      source: source || null,
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
};

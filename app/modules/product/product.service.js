const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ProductSearchableFields } = require("./product.constants");
const Product = db.product;
const Variation = db.variation;
const InventoryMaster = db.inventoryMaster;

const productNameSyncModels = [
  { Model: db.purchaseRequisition, reference: "product" },
  { Model: db.receivedProduct, reference: "product" },
  { Model: db.purchaseReturnProduct, reference: "inventory" },
  { Model: db.inTransitProduct, reference: "inventory" },
  { Model: db.returnProduct, reference: "inventory" },
  { Model: db.damageStock, reference: "product" },
  { Model: db.damageProduct, reference: "inventory" },
  { Model: db.damageRepair, reference: "damageStock" },
  { Model: db.damageReparingStock, reference: "product" },
  { Model: db.damageRepaired, reference: "repairingStock" },
];

const parseItems = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const hasAttribute = (Model, attribute) =>
  Boolean(Model?.rawAttributes?.[attribute]);

const buildJoinedName = (items = []) =>
  items
    .map((item) => String(item?.name || "").trim())
    .filter(Boolean)
    .join(", ");

const renameItemsByReference = (
  items = [],
  referenceIds = [],
  nextName,
  previousNames = [],
) => {
  const idSet = new Set(referenceIds.map((item) => Number(item)));
  const previousNameSet = new Set(
    previousNames.map((item) => String(item || "").trim()).filter(Boolean),
  );
  let changed = false;

  const renamedItems = items.map((item) => {
    const itemProductId = Number(item?.productId ?? item?.receivedId);
    const itemName = String(item?.name || "").trim();
    if (!idSet.has(itemProductId) && !previousNameSet.has(itemName)) {
      return item;
    }

    changed = true;
    return {
      ...item,
      name: nextName,
    };
  });

  return { changed, items: renamedItems };
};

const syncNameRows = async (
  Model,
  referenceIds,
  nextName,
  transaction,
  previousNames = [],
) => {
  if (!Model) return;

  const previousNameSet = new Set(
    previousNames.map((item) => String(item || "").trim()).filter(Boolean),
  );
  if (!referenceIds.length && !previousNameSet.size) return;

  const attributes = ["Id", "name"];
  if (hasAttribute(Model, "productId")) attributes.push("productId");
  if (hasAttribute(Model, "items")) attributes.push("items");

  const rows = await Model.findAll({
    attributes,
    transaction,
    paranoid: false,
  });

  await Promise.all(
    rows.map(async (row) => {
      const rowProductId = Number(row.productId);
      const items = parseItems(row.items);
      const data = {};

      if (items.length) {
        const renamed = renameItemsByReference(
          items,
          referenceIds,
          nextName,
          previousNames,
        );
        if (!renamed.changed) return;

        data.items = renamed.items;
        data.name = buildJoinedName(renamed.items) || nextName;
      } else if (
        referenceIds.includes(rowProductId) ||
        previousNameSet.has(String(row.name || "").trim())
      ) {
        data.name = nextName;
      } else {
        return;
      }

      await row.update(data, { transaction });
    }),
  );
};

const syncProductNameReferences = async (
  productId,
  nextName,
  transaction,
  previousNames = [],
) => {
  const [inventoryRows, damageStockRows, repairingStockRows] =
    await Promise.all([
      InventoryMaster.findAll({
        attributes: ["Id"],
        where: { productId },
        transaction,
        paranoid: false,
      }),
      db.damageStock.findAll({
        attributes: ["Id"],
        where: { productId },
        transaction,
        paranoid: false,
      }),
      db.damageReparingStock.findAll({
        attributes: ["Id"],
        where: { productId },
        transaction,
        paranoid: false,
      }),
    ]);
  const inventoryIds = inventoryRows.map((row) => Number(row.Id));
  const damageStockIds = damageStockRows.map((row) => Number(row.Id));
  const repairingStockIds = repairingStockRows.map((row) => Number(row.Id));

  await InventoryMaster.update(
    { name: nextName },
    {
      where: { productId },
      transaction,
      paranoid: false,
    },
  );

  await Promise.all(
    productNameSyncModels.map(({ Model, reference }) => {
      const referenceIds = {
        damageStock: damageStockIds,
        inventory: inventoryIds,
        product: [productId],
        repairingStock: repairingStockIds,
      }[reference];

      return syncNameRows(
        Model,
        referenceIds || [],
        nextName,
        transaction,
        previousNames,
      );
    }),
  );
};

const attachDeleteRestriction = async (rows, transaction) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const products = rows.map((row) =>
    typeof row?.get === "function" ? row.get({ plain: true }) : row,
  );
  const productIds = products.map((product) => Number(product.Id)).filter(Boolean);
  const stockIds = products
    .map((product) => Number(product.stockId))
    .filter(Boolean);

  if (!productIds.length && !stockIds.length) return products;

  const inventoryRows = await InventoryMaster.findAll({
    attributes: ["Id", "productId"],
    where: {
      [Op.or]: [
        { productId: { [Op.in]: productIds } },
        { Id: { [Op.in]: stockIds } },
      ],
    },
    transaction,
  });

  const restrictedProductIds = new Set();
  const restrictedStockIds = new Set();

  inventoryRows.forEach((row) => {
    const productId = Number(row.productId);
    const stockId = Number(row.Id);
    if (productId) restrictedProductIds.add(productId);
    if (stockId) restrictedStockIds.add(stockId);
  });

  return products.map((product) => ({
    ...product,
    isDeleteRestricted:
      restrictedProductIds.has(Number(product.Id)) ||
      restrictedStockIds.has(Number(product.stockId)),
  }));
};

const insertIntoDB = async (data) => {
  const { name, size, color, sku } = data;

  const payload = {
    name,
    sku,
  };

  const result = await Product.create(payload);

  if (size || color) {
    const variationData = {
      size: size || null,
      color: color || null,
      productId: result.Id, // Associate with the created product
    };
    await Variation.create(variationData);
  }

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ProductSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Product.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Variation,
        as: "variations",
      },
    ],
    paranoid: true,
    order: (() => {
      const ALLOWED_SORT_COLUMNS = new Set([
        "createdAt", "updatedAt", "name", "price", "stock",
      ]);
      const ALLOWED_SORT_ORDERS = new Set(["ASC", "DESC"]);
      const col = options.sortBy;
      const ord = (options.sortOrder || "").toUpperCase();
      if (col && ALLOWED_SORT_COLUMNS.has(col) && ALLOWED_SORT_ORDERS.has(ord)) {
        return [[col, ord]];
      }
      return [["createdAt", "DESC"]];
    })(),
  });

  const count = await Product.count({ where: whereConditions });

  const rows = await attachDeleteRestriction(result);

  return {
    meta: { count, page, limit },
    data: rows,
  };
};

const getDataById = async (id) => {
  const result = await Product.findOne({
    where: {
      stockId: id,
    },
    include: [
      {
        model: db.variation,
        as: "variations",
      },
    ],
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (transaction) => {
    const product = await Product.findOne({
      where: { Id: id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!product) throw new ApiError(404, "Product not found");

    const inventoryWhere = {
      [Op.or]: [{ productId: id }],
    };

    if (product.stockId) {
      inventoryWhere[Op.or].push({ Id: product.stockId });
    }

    const inventoryCount = await InventoryMaster.count({
      where: inventoryWhere,
      transaction,
    });

    if (inventoryCount || product.stockId) {
      throw new ApiError(
        400,
        "This product cannot be deleted because it exists in inventory/stock",
      );
    }

    return Product.destroy({
      where: {
        Id: id,
      },
      transaction,
    });
  });
};

const updateOneFromDB = async (id, payload) => {
  const { name, size, color, sku } = payload;

  return db.sequelize.transaction(async (transaction) => {
    const existingProduct = await Product.findOne({
      where: { Id: id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!existingProduct) throw new ApiError(404, "Product not found");

    const data = {
      name,
      sku,
    };
    const result = await Product.update(data, {
      where: {
        Id: id,
      },
      transaction,
    });

    const nextName = String(name || "").trim();
    const oldName = String(existingProduct.name || "").trim();
    if (nextName) {
      await syncProductNameReferences(
        Number(id),
        nextName,
        transaction,
        oldName && oldName !== nextName ? [oldName] : [],
      );
    }

    const existingVariation = await Variation.findOne({
      where: { productId: id },
      transaction,
    });

    if (existingVariation) {
      await Variation.update(
        {
          size: size || existingVariation.size,
          color: color || existingVariation.color,
        },
        {
          where: { productId: id },
          transaction,
        },
      );
    } else if (size || color) {
      const variationData = {
        size: size || null,
        color: color || null,
        productId: id,
      };
      await Variation.create(variationData, {
        transaction,
      });
    }

    return result;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Product.findAll({
    include: [
      {
        model: db.variation,
        as: "variations",
      },
    ],
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return attachDeleteRestriction(result);
};

const getReceivedDataById = async (id) => {
  const result = await Product.findOne({
    where: {
      Id: id,
    },
    include: [
      {
        model: db.variation,
        as: "variations",
      },
    ],
  });

  return result;
};

const ProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getReceivedDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ProductService;

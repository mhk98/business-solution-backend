const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");

const AssetsStock = db.assetsStock;
const AssetsPurchase = db.assetsPurchase;
const AssetsSale = db.assetsSale;
const AssetsDamage = db.assetsDamage;
const Asset = db.asset;
const STOCK_STATUSES = ["Active", "Approved"];

const n = (value) => Number(value || 0);

const normalizeName = (value) => String(value || "").trim();

const ensureStockByName = async (name, transaction, assetId = null) => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return null;

  const [stock] = await AssetsStock.findOrCreate({
    where: { name: normalizedName },
    defaults: { name: normalizedName, assetId, quantity: 0, price: 0 },
    transaction,
  });

  if (assetId && !stock.assetId) {
    await stock.update({ assetId }, { transaction });
  }

  return stock;
};

const ensureStockByAsset = async (asset, transaction) => {
  if (!asset?.Id) return ensureStockByName(asset?.name, transaction);

  const stockByAsset = await AssetsStock.findOne({
    where: { assetId: asset.Id },
    transaction,
  });

  if (stockByAsset) return stockByAsset;

  return ensureStockByName(asset.name, transaction, asset.Id);
};

const ensureStockForMovement = async (row, assetById, transaction) => {
  if (row.assetId && assetById.has(Number(row.assetId))) {
    return ensureStockByAsset(assetById.get(Number(row.assetId)), transaction);
  }

  return ensureStockByName(row.name, transaction);
};

const getMovementAttributes = (Model) => {
  const attributes = ["name"];
  if (Model?.rawAttributes?.assetId) attributes.push("assetId");
  if (Model?.rawAttributes?.productId) attributes.push("productId");
  return attributes;
};

const buildStockResolver = (stocks) => {
  const stockIdByProductId = new Map();
  const stockIdByAssetId = new Map();
  const stockIdByName = new Map();

  stocks.forEach((stock) => {
    stockIdByProductId.set(Number(stock.Id), stock.Id);
    if (stock.assetId) stockIdByAssetId.set(Number(stock.assetId), stock.Id);
    stockIdByName.set(normalizeName(stock.name), stock.Id);
  });

  return {
    stockIdByProductId,
    stockIdByAssetId,
    stockIdByName,
  };
};

const resolveMovementStockId = (row, resolver) => {
  if (row.productId && resolver.stockIdByProductId.has(Number(row.productId))) {
    return resolver.stockIdByProductId.get(Number(row.productId));
  }

  if (row.assetId && resolver.stockIdByAssetId.has(Number(row.assetId))) {
    return resolver.stockIdByAssetId.get(Number(row.assetId));
  }

  const byName = resolver.stockIdByName.get(normalizeName(row.name));
  return byName || null;
};

const getLatestPurchasesByStock = (purchases, resolver) => {
  const latestPrices = new Map();

  purchases.forEach((row) => {
    const stockId = resolveMovementStockId(row, resolver);
    if (!stockId || latestPrices.has(stockId)) return;
    latestPrices.set(stockId, n(row.price));
  });

  return latestPrices;
};

const getPurchaseCostsByStock = (purchases, resolver) => {
  const costs = new Map();

  purchases.forEach((row) => {
    const stockId = resolveMovementStockId(row, resolver);
    if (!stockId) return;

    const current = costs.get(stockId) || { quantity: 0, amount: 0 };
    const quantity = n(row.quantity);
    const amount =
      row.total === undefined ? quantity * n(row.price) : n(row.total);

    costs.set(stockId, {
      quantity: current.quantity + quantity,
      amount: current.amount + amount,
    });
  });

  return costs;
};

const applyMovement = (balances, resolver, row, direction) => {
  const stockId = resolveMovementStockId(row, resolver);
  if (!stockId) return;

  const nextQty = n(balances.get(stockId)) + direction * n(row.quantity);
  balances.set(stockId, nextQty);
};

const ensureAssetStocksLinkedByName = async (transaction) => {
  if (!Asset) return;

  const assets = await Asset.findAll({
    attributes: ["Id", "name"],
    raw: true,
    transaction,
  });

  await Promise.all(
    assets.map((asset) => ensureStockByAsset(asset, transaction)),
  );
};

const getAssetsById = async (transaction) => {
  if (!Asset) return new Map();

  const assets = await Asset.findAll({
    attributes: ["Id", "name"],
    raw: true,
    transaction,
  });

  return new Map(assets.map((asset) => [Number(asset.Id), asset]));
};

const ensureSeedAssetsStocks = async (transaction) => {
  const assetById = await getAssetsById(transaction);
  await ensureAssetStocksLinkedByName(transaction);

  const rows = await Promise.all([
    AssetsPurchase.findAll({
      attributes: getMovementAttributes(AssetsPurchase),
      where: { name: { [Op.ne]: null } },
      raw: true,
      transaction,
    }),
    AssetsSale.findAll({
      attributes: getMovementAttributes(AssetsSale),
      where: { name: { [Op.ne]: null } },
      raw: true,
      transaction,
    }),
    AssetsDamage.findAll({
      attributes: getMovementAttributes(AssetsDamage),
      where: { name: { [Op.ne]: null } },
      raw: true,
      transaction,
    }),
  ]);

  const movements = rows.flat();
  await Promise.all(
    movements.map((row) => ensureStockForMovement(row, assetById, transaction)),
  );
};

const getMovementQueryAttributes = (Model, extraAttributes = []) => {
  const attributes = ["Id", "name", "productId", "quantity", "status"];
  if (Model?.rawAttributes?.assetId) attributes.push("assetId");
  extraAttributes.forEach((attribute) => {
    if (!attributes.includes(attribute)) attributes.push(attribute);
  });
  return attributes;
};

const rebuildAssetsStockBalances = async (transaction) => {
  if (!AssetsStock) return;

  await ensureSeedAssetsStocks(transaction);

  const [stocks, purchases, sales, damages] = await Promise.all([
    AssetsStock.findAll({
      attributes: ["Id", "name", "assetId", "price"],
      raw: true,
      transaction,
    }),
    AssetsPurchase.findAll({
      attributes: getMovementQueryAttributes(AssetsPurchase, [
        "price",
        "total",
        "date",
        "createdAt",
      ]),
      where: { status: { [Op.in]: STOCK_STATUSES } },
      order: [
        ["date", "DESC"],
        ["createdAt", "DESC"],
        ["Id", "DESC"],
      ],
      raw: true,
      transaction,
    }),
    AssetsSale.findAll({
      attributes: getMovementQueryAttributes(AssetsSale),
      where: { status: { [Op.in]: STOCK_STATUSES } },
      raw: true,
      transaction,
    }),
    AssetsDamage.findAll({
      attributes: getMovementQueryAttributes(AssetsDamage),
      where: { status: { [Op.in]: STOCK_STATUSES } },
      raw: true,
      transaction,
    }),
  ]);

  const resolver = buildStockResolver(stocks);
  const balances = new Map(stocks.map((stock) => [stock.Id, 0]));
  const latestPrices = getLatestPurchasesByStock(purchases, resolver);
  const purchaseCosts = getPurchaseCostsByStock(purchases, resolver);

  purchases.forEach((row) => applyMovement(balances, resolver, row, 1));
  sales.forEach((row) => applyMovement(balances, resolver, row, -1));
  damages.forEach((row) => applyMovement(balances, resolver, row, -1));

  for (const [stockId, quantity] of balances.entries()) {
    if (quantity < 0) {
      const stock = stocks.find((item) => item.Id === stockId);
      throw new ApiError(
        400,
        `Assets stock mismatch for ${stock?.name || "selected asset"}`,
      );
    }
  }

  await Promise.all(
    stocks.map((stock) =>
      AssetsStock.update(
        {
          quantity: n(balances.get(stock.Id)),
          price: (() => {
            const cost = purchaseCosts.get(stock.Id);
            if (cost?.quantity) {
              return Math.round(n(cost.amount) / n(cost.quantity));
            }

            return latestPrices.has(stock.Id)
              ? n(latestPrices.get(stock.Id))
              : n(stock.price);
          })(),
        },
        {
          where: { Id: stock.Id },
          transaction,
        },
      ),
    ),
  );
};

/*
 * Keep the exports stable for existing services. The legacy name helper is
 * still useful when old rows only have a name and no assetId yet.
 */

module.exports = {
  STOCK_STATUSES,
  ensureStockByName,
  ensureSeedAssetsStocks,
  rebuildAssetsStockBalances,
};

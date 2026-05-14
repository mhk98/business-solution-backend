const { Op } = require("sequelize");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");

const AssetsStock = db.assetsStock;
const AssetsPurchase = db.assetsPurchase;
const AssetsSale = db.assetsSale;
const AssetsDamage = db.assetsDamage;
const STOCK_STATUSES = ["Active", "Approved"];

const n = (value) => Number(value || 0);

const normalizeName = (value) => String(value || "").trim();

const ensureStockByName = async (name, transaction) => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return null;

  const [stock] = await AssetsStock.findOrCreate({
    where: { name: normalizedName },
    defaults: { name: normalizedName, quantity: 0, price: 0 },
    transaction,
  });

  return stock;
};

const ensureSeedAssetsStocks = async (transaction) => {
  const rows = await Promise.all([
    AssetsPurchase.findAll({
      attributes: ["name"],
      where: { name: { [Op.ne]: null } },
      raw: true,
      transaction,
    }),
    AssetsSale.findAll({
      attributes: ["name"],
      where: { name: { [Op.ne]: null } },
      raw: true,
      transaction,
    }),
    AssetsDamage.findAll({
      attributes: ["name"],
      where: { name: { [Op.ne]: null } },
      raw: true,
      transaction,
    }),
  ]);

  const uniqueNames = [...new Set(rows.flat().map((row) => normalizeName(row.name)).filter(Boolean))];

  await Promise.all(uniqueNames.map((name) => ensureStockByName(name, transaction)));
};

const resolveMovementStockId = (row, stockIdByName) => {
  if (row.productId && stockIdByName.has(Number(row.productId))) {
    return Number(row.productId);
  }

  const byName = stockIdByName.get(normalizeName(row.name));
  return byName || null;
};

const rebuildAssetsStockBalances = async (transaction) => {
  if (!AssetsStock) return;

  await ensureSeedAssetsStocks(transaction);

  const [stocks, purchases, sales, damages] = await Promise.all([
    AssetsStock.findAll({
      attributes: ["Id", "name", "price"],
      raw: true,
      transaction,
    }),
    AssetsPurchase.findAll({
      attributes: [
        "Id",
        "name",
        "productId",
        "quantity",
        "price",
        "date",
        "createdAt",
        "status",
      ],
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
      attributes: ["Id", "name", "productId", "quantity", "status"],
      where: { status: { [Op.in]: STOCK_STATUSES } },
      raw: true,
      transaction,
    }),
    AssetsDamage.findAll({
      attributes: ["Id", "name", "productId", "quantity", "status"],
      where: { status: { [Op.in]: STOCK_STATUSES } },
      raw: true,
      transaction,
    }),
  ]);

  const stockIdByName = new Map();
  stocks.forEach((stock) => {
    stockIdByName.set(normalizeName(stock.name), stock.Id);
    stockIdByName.set(Number(stock.Id), stock.Id);
  });

  const balances = new Map(stocks.map((stock) => [stock.Id, 0]));
  const latestPrices = new Map();

  const addBalance = (row, direction) => {
    const stockId = resolveMovementStockId(row, stockIdByName);
    if (!stockId) return;

    const nextQty = n(balances.get(stockId)) + direction * n(row.quantity);
    balances.set(stockId, nextQty);
  };

  purchases.forEach((row) => {
    const stockId = resolveMovementStockId(row, stockIdByName);
    if (!stockId || latestPrices.has(stockId)) return;
    latestPrices.set(stockId, n(row.price));
  });
  purchases.forEach((row) => addBalance(row, 1));
  sales.forEach((row) => addBalance(row, -1));
  damages.forEach((row) => addBalance(row, -1));

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
          price: latestPrices.has(stock.Id)
            ? n(latestPrices.get(stock.Id))
            : n(stock.price),
        },
        {
          where: { Id: stock.Id },
          transaction,
        },
      ),
    ),
  );
};

module.exports = {
  STOCK_STATUSES,
  ensureStockByName,
  ensureSeedAssetsStocks,
  rebuildAssetsStockBalances,
};

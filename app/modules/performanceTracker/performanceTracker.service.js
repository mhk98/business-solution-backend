const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");

const Channel = db.performanceTrackerChannel;
const AdsAccount = db.performanceTrackerAdsAccount;
const Product = db.performanceTrackerProduct;
const Entry = db.marketingPerformanceEntry;
const Target = db.channelPerformanceTarget;

const DEFAULT_TARGET = {
  target_marketing_cost_percent: 15,
  roas_alert_threshold: 3,
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const round2 = (value) => Number((Number(value) || 0).toFixed(2));

const safeDivide = (numerator, denominator, multiplier = 1) => {
  const bottom = toNumber(denominator);
  if (!bottom) return 0;
  return round2((toNumber(numerator) / bottom) * multiplier);
};

const normalizeTarget = (target = DEFAULT_TARGET) => ({
  target_marketing_cost_percent: toNumber(
    target?.target_marketing_cost_percent ?? DEFAULT_TARGET.target_marketing_cost_percent,
  ),
  roas_alert_threshold: toNumber(
    target?.roas_alert_threshold ?? DEFAULT_TARGET.roas_alert_threshold,
  ),
});

const getChannelTarget = (targetByChannel, channelId) =>
  normalizeTarget(targetByChannel.get(Number(channelId)) || DEFAULT_TARGET);

const calculateEntryMetrics = (entry = {}) => {
  const spendUsd = toNumber(entry.spend_usd);
  const usdRate = toNumber(entry.usd_rate);
  const spendLocal = round2(entry.spend_local ?? spendUsd * usdRate);
  const revenue = toNumber(entry.total_revenue_local);
  const orders = toNumber(entry.total_orders);

  return {
    ...entry,
    spend_usd: spendUsd,
    usd_rate: usdRate,
    spend_local: spendLocal,
    total_revenue_local: revenue,
    total_orders: orders,
    roas: safeDivide(revenue, spendLocal),
    marketing_cost_percent: safeDivide(spendLocal, revenue, 100),
    revenue_per_usd: safeDivide(revenue, spendUsd),
    cost_per_order: safeDivide(spendLocal, orders),
  };
};

const calculateSummary = (rows = [], target = DEFAULT_TARGET) => {
  const resolvedTarget = normalizeTarget(target);
  const totals = rows.reduce(
    (acc, row) => {
      acc.spend_usd += toNumber(row.spend_usd);
      acc.spend_local += toNumber(row.spend_local);
      acc.total_revenue_local += toNumber(row.total_revenue_local);
      acc.total_orders += toNumber(row.total_orders);
      return acc;
    },
    {
      spend_usd: 0,
      spend_local: 0,
      total_revenue_local: 0,
      total_orders: 0,
    },
  );

  const metrics = calculateEntryMetrics(totals);
  return {
    ...metrics,
    spend_usd: round2(totals.spend_usd),
    spend_local: round2(totals.spend_local),
    total_revenue_local: round2(totals.total_revenue_local),
    total_orders: totals.total_orders,
    target_marketing_cost_percent: resolvedTarget.target_marketing_cost_percent,
    roas_alert_threshold: resolvedTarget.roas_alert_threshold,
    is_over_target:
      metrics.marketing_cost_percent > resolvedTarget.target_marketing_cost_percent,
    is_below_roas_threshold:
      metrics.roas < resolvedTarget.roas_alert_threshold,
  };
};

const toPlain = (row) =>
  typeof row?.get === "function" ? row.get({ plain: true }) : row;

const withMetrics = (row) => {
  const plain = toPlain(row);
  return calculateEntryMetrics(plain);
};

const normalizeChannelPayload = (payload = {}, actor = {}) => {
  const name = String(payload.name || "").trim();
  if (!name) throw new ApiError(400, "Channel name is required");

  return {
    name,
    short_code: payload.short_code ? String(payload.short_code).trim() : null,
    color: payload.color || "#4f46e5",
    created_by: actor?.Id || payload.created_by || null,
  };
};

const normalizeNamedChildPayload = (payload = {}, actor = {}, codeKey = "account_code") => {
  const channelId = Number(payload.channel_id);
  const name = String(payload.name || "").trim();

  if (!channelId) throw new ApiError(400, "Channel is required");
  if (!name) throw new ApiError(400, "Name is required");

  return {
    channel_id: channelId,
    name,
    [codeKey]: payload[codeKey] ? String(payload[codeKey]).trim() : null,
    created_by: actor?.Id || payload.created_by || null,
  };
};

const normalizeEntryPayload = (payload = {}, actor = {}) => {
  const channelId = Number(payload.channel_id);
  const spendUsd = toNumber(payload.spend_usd);
  const usdRate = toNumber(payload.usd_rate);
  const revenue = toNumber(payload.total_revenue_local);
  const orders = toNumber(payload.total_orders);

  if (!channelId) throw new ApiError(400, "Channel is required");
  if (!payload.date) throw new ApiError(400, "Date is required");
  if (spendUsd < 0 || usdRate < 0 || revenue < 0 || orders < 0) {
    throw new ApiError(400, "Numeric fields cannot be negative");
  }

  return {
    channel_id: channelId,
    ads_account_id: payload.ads_account_id ? Number(payload.ads_account_id) : null,
    product_id: payload.product_id ? Number(payload.product_id) : null,
    date: payload.date,
    spend_usd: spendUsd,
    usd_rate: usdRate,
    spend_local: round2(spendUsd * usdRate),
    total_revenue_local: revenue,
    total_orders: orders,
    note: payload.note || null,
    created_by: actor?.Id || payload.created_by || null,
  };
};

const normalizeTargetPayload = (payload = {}, actor = {}) => ({
  channel_id: Number(payload.channel_id),
  target_marketing_cost_percent: toNumber(
    payload.target_marketing_cost_percent ?? DEFAULT_TARGET.target_marketing_cost_percent,
  ),
  roas_alert_threshold: toNumber(
    payload.roas_alert_threshold ?? DEFAULT_TARGET.roas_alert_threshold,
  ),
  created_by: actor?.Id || payload.created_by || null,
});

const buildEntryWhere = (filters = {}) => {
  const { channel_id, ads_account_id, product_id, startDate, endDate, searchTerm } = filters;
  const andConditions = [];

  if (channel_id) andConditions.push({ channel_id: Number(channel_id) });
  if (ads_account_id) andConditions.push({ ads_account_id: Number(ads_account_id) });
  if (product_id) andConditions.push({ product_id: Number(product_id) });
  if (startDate && endDate) {
    andConditions.push({ date: { [Op.between]: [startDate, endDate] } });
  } else if (startDate) {
    andConditions.push({ date: { [Op.gte]: startDate } });
  } else if (endDate) {
    andConditions.push({ date: { [Op.lte]: endDate } });
  }
  if (searchTerm) {
    andConditions.push({
      [Op.or]: [{ note: { [Op.like]: `%${String(searchTerm).trim()}%` } }],
    });
  }

  return andConditions.length ? { [Op.and]: andConditions } : {};
};

const ensureTarget = async (channelId, actor = {}) => {
  const [target] = await Target.findOrCreate({
    where: { channel_id: channelId },
    defaults: {
      channel_id: channelId,
      ...DEFAULT_TARGET,
      created_by: actor?.Id || null,
    },
  });
  return target;
};

const createChannel = async (payload, actor) => {
  const channel = await Channel.create(normalizeChannelPayload(payload, actor));
  await ensureTarget(channel.Id, actor);
  return channel;
};

const getChannels = async (filters = {}, options = {}) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const where = filters.searchTerm
    ? { name: { [Op.like]: `%${String(filters.searchTerm).trim()}%` } }
    : {};

  const [data, count] = await Promise.all([
    Channel.findAll({
      where,
      include: [{ model: Target, as: "target", required: false }],
      order: [["createdAt", "DESC"]],
      limit,
      offset: skip,
    }),
    Channel.count({ where }),
  ]);

  return { meta: { page, limit, count }, data };
};

const getAllChannels = async () =>
  Channel.findAll({
    include: [{ model: Target, as: "target", required: false }],
    order: [["name", "ASC"]],
  });

const getAdsAccounts = async (filters = {}, options = {}) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const andConditions = [];

  if (filters.channel_id) andConditions.push({ channel_id: Number(filters.channel_id) });
  if (filters.searchTerm) {
    andConditions.push({
      name: { [Op.like]: `%${String(filters.searchTerm).trim()}%` },
    });
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const [data, count] = await Promise.all([
    AdsAccount.findAll({
      where,
      include: [{ model: Channel, as: "channel", required: false }],
      order: [["createdAt", "DESC"]],
      limit,
      offset: skip,
    }),
    AdsAccount.count({ where }),
  ]);

  return { meta: { page, limit, count }, data };
};

const getAllAdsAccounts = async (filters = {}) => {
  const where = filters.channel_id ? { channel_id: Number(filters.channel_id) } : {};
  return AdsAccount.findAll({
    where,
    include: [{ model: Channel, as: "channel", required: false }],
    order: [["name", "ASC"]],
  });
};

const createAdsAccount = async (payload, actor) => {
  const data = normalizeNamedChildPayload(payload, actor, "account_code");
  const channel = await Channel.findByPk(data.channel_id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  return AdsAccount.create(data);
};

const updateAdsAccount = async (id, payload, actor) => {
  const adsAccount = await AdsAccount.findByPk(id);
  if (!adsAccount) throw new ApiError(404, "Ads account not found");
  const data = normalizeNamedChildPayload(payload, actor, "account_code");
  const channel = await Channel.findByPk(data.channel_id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  return adsAccount.update(data);
};

const deleteAdsAccount = async (id) => {
  const adsAccount = await AdsAccount.findByPk(id);
  if (!adsAccount) throw new ApiError(404, "Ads account not found");
  await adsAccount.destroy();
  return adsAccount;
};

const getProducts = async (filters = {}, options = {}) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const andConditions = [];

  if (filters.channel_id) andConditions.push({ channel_id: Number(filters.channel_id) });
  if (filters.searchTerm) {
    andConditions.push({
      name: { [Op.like]: `%${String(filters.searchTerm).trim()}%` },
    });
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const [data, count] = await Promise.all([
    Product.findAll({
      where,
      include: [{ model: Channel, as: "channel", required: false }],
      order: [["createdAt", "DESC"]],
      limit,
      offset: skip,
    }),
    Product.count({ where }),
  ]);

  return { meta: { page, limit, count }, data };
};

const getAllProducts = async (filters = {}) => {
  const where = filters.channel_id ? { channel_id: Number(filters.channel_id) } : {};
  return Product.findAll({
    where,
    include: [{ model: Channel, as: "channel", required: false }],
    order: [["name", "ASC"]],
  });
};

const createProduct = async (payload, actor) => {
  const data = normalizeNamedChildPayload(payload, actor, "sku");
  const channel = await Channel.findByPk(data.channel_id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  return Product.create(data);
};

const updateProduct = async (id, payload, actor) => {
  const product = await Product.findByPk(id);
  if (!product) throw new ApiError(404, "Product not found");
  const data = normalizeNamedChildPayload(payload, actor, "sku");
  const channel = await Channel.findByPk(data.channel_id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  return product.update(data);
};

const deleteProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) throw new ApiError(404, "Product not found");
  await product.destroy();
  return product;
};

const updateChannel = async (id, payload, actor) => {
  const channel = await Channel.findByPk(id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  await channel.update(normalizeChannelPayload(payload, actor));
  return channel;
};

const deleteChannel = async (id) => {
  const channel = await Channel.findByPk(id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  await channel.destroy();
  return channel;
};

const createEntry = async (payload, actor) => {
  const data = normalizeEntryPayload(payload, actor);
  const channel = await Channel.findByPk(data.channel_id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  if (data.ads_account_id) {
    const adsAccount = await AdsAccount.findOne({
      where: { Id: data.ads_account_id, channel_id: data.channel_id },
    });
    if (!adsAccount) throw new ApiError(404, "Ads account not found for selected channel");
  }
  if (data.product_id) {
    const product = await Product.findOne({
      where: { Id: data.product_id, channel_id: data.channel_id },
    });
    if (!product) throw new ApiError(404, "Product not found for selected channel");
  }
  const entry = await Entry.create(data);
  return withMetrics(entry);
};

const getEntries = async (filters = {}, options = {}) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const where = buildEntryWhere(filters);

  const [rows, count] = await Promise.all([
    Entry.findAll({
      where,
      include: [
        { model: Channel, as: "channel", required: false },
        { model: AdsAccount, as: "adsAccount", required: false },
        { model: Product, as: "product", required: false },
      ],
      order: [["date", "DESC"], ["createdAt", "DESC"]],
      limit,
      offset: skip,
    }),
    Entry.count({ where }),
  ]);

  return { meta: { page, limit, count }, data: rows.map(withMetrics) };
};

const getAllEntries = async (filters = {}) => {
  const rows = await Entry.findAll({
    where: buildEntryWhere(filters),
    include: [
      { model: Channel, as: "channel", required: false },
      { model: AdsAccount, as: "adsAccount", required: false },
      { model: Product, as: "product", required: false },
    ],
    order: [["date", "ASC"], ["createdAt", "ASC"]],
  });
  return rows.map(withMetrics);
};

const updateEntry = async (id, payload, actor) => {
  const entry = await Entry.findByPk(id);
  if (!entry) throw new ApiError(404, "Tracker entry not found");
  const data = normalizeEntryPayload(payload, actor);
  const channel = await Channel.findByPk(data.channel_id);
  if (!channel) throw new ApiError(404, "Tracker channel not found");
  if (data.ads_account_id) {
    const adsAccount = await AdsAccount.findOne({
      where: { Id: data.ads_account_id, channel_id: data.channel_id },
    });
    if (!adsAccount) throw new ApiError(404, "Ads account not found for selected channel");
  }
  if (data.product_id) {
    const product = await Product.findOne({
      where: { Id: data.product_id, channel_id: data.channel_id },
    });
    if (!product) throw new ApiError(404, "Product not found for selected channel");
  }
  await entry.update(data);
  return withMetrics(entry);
};

const deleteEntry = async (id) => {
  const entry = await Entry.findByPk(id);
  if (!entry) throw new ApiError(404, "Tracker entry not found");
  await entry.destroy();
  return entry;
};

const getTargets = async () => {
  const channels = await getAllChannels();
  await Promise.all(channels.map((channel) => ensureTarget(channel.Id)));
  return getAllChannels();
};

const saveTargets = async (targets = [], actor = {}) => {
  if (!Array.isArray(targets)) throw new ApiError(400, "Targets must be an array");

  await Promise.all(
    targets.map(async (payload) => {
      const data = normalizeTargetPayload(payload, actor);
      if (!data.channel_id) return null;
      const [target] = await Target.findOrCreate({
        where: { channel_id: data.channel_id },
        defaults: data,
      });
      return target.update(data);
    }),
  );

  return getTargets();
};

const resolveDashboardTarget = (filters, adsAccounts, products, targetByChannel) => {
  if (filters.channel_id) {
    return getChannelTarget(targetByChannel, filters.channel_id);
  }

  if (filters.ads_account_id) {
    const adsAccount = adsAccounts.find(
      (item) => Number(item.Id) === Number(filters.ads_account_id),
    );
    if (adsAccount) return getChannelTarget(targetByChannel, adsAccount.channel_id);
  }

  if (filters.product_id) {
    const product = products.find((item) => Number(item.Id) === Number(filters.product_id));
    if (product) return getChannelTarget(targetByChannel, product.channel_id);
  }

  return normalizeTarget(DEFAULT_TARGET);
};

const getDashboard = async (filters = {}) => {
  const [channels, adsAccounts, products, targets, entries] = await Promise.all([
    getAllChannels(),
    getAllAdsAccounts(),
    getAllProducts(),
    Target.findAll(),
    getAllEntries(filters),
  ]);
  const targetByChannel = new Map(targets.map((t) => [Number(t.channel_id), toPlain(t)]));
  const target = resolveDashboardTarget(filters, adsAccounts, products, targetByChannel);

  const byDate = new Map();
  const byChannel = new Map();
  const byAdsAccount = new Map();
  const byProduct = new Map();

  entries.forEach((entry) => {
    const date = entry.date;
    const channelId = Number(entry.channel_id);
    const adsAccountId = Number(entry.ads_account_id || 0);
    const productId = Number(entry.product_id || 0);
    byDate.set(date, [...(byDate.get(date) || []), entry]);
    byChannel.set(channelId, [...(byChannel.get(channelId) || []), entry]);
    if (adsAccountId) {
      byAdsAccount.set(adsAccountId, [...(byAdsAccount.get(adsAccountId) || []), entry]);
    }
    if (productId) {
      byProduct.set(productId, [...(byProduct.get(productId) || []), entry]);
    }
  });

  const timeline = Array.from(byDate.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([date, rows]) => {
      const channelIds = [...new Set(rows.map((row) => Number(row.channel_id)).filter(Boolean))];
      const rowTarget =
        channelIds.length === 1 ? getChannelTarget(targetByChannel, channelIds[0]) : target;
      return { date, ...calculateSummary(rows, rowTarget) };
    });

  const channelSummaries = channels.map((channel) => {
    const plain = toPlain(channel);
    const channelTarget = getChannelTarget(targetByChannel, plain.Id);
    return {
      channel: plain,
      ...calculateSummary(byChannel.get(Number(plain.Id)) || [], channelTarget),
    };
  });

  const adsAccountSummaries = adsAccounts
    .filter((adsAccount) => !filters.channel_id || Number(adsAccount.channel_id) === Number(filters.channel_id))
    .map((adsAccount) => {
      const plain = toPlain(adsAccount);
      const channelTarget = getChannelTarget(targetByChannel, plain.channel_id);
      return {
        adsAccount: plain,
        ...calculateSummary(byAdsAccount.get(Number(plain.Id)) || [], channelTarget),
      };
    });

  const productSummaries = products
    .filter((product) => !filters.channel_id || Number(product.channel_id) === Number(filters.channel_id))
    .map((product) => {
      const plain = toPlain(product);
      const channelTarget = getChannelTarget(targetByChannel, plain.channel_id);
      return {
        product: plain,
        ...calculateSummary(byProduct.get(Number(plain.Id)) || [], channelTarget),
      };
    });

  const summary = calculateSummary(entries, target);
  const alertChannels = channelSummaries.filter(
    (item) => item.spend_local > 0 && item.is_over_target,
  );

  return {
    summary,
    timeline,
    channelSummaries,
    adsAccountSummaries,
    productSummaries,
    alertChannels,
  };
};

const getCompare = async (filters = {}) => {
  const channelIds = String(filters.channel_ids || "")
    .split(",")
    .map((id) => Number(id))
    .filter(Boolean);
  const adsAccountIds = String(filters.ads_account_ids || "")
    .split(",")
    .map((id) => Number(id))
    .filter(Boolean);
  const productIds = String(filters.product_ids || "")
    .split(",")
    .map((id) => Number(id))
    .filter(Boolean);
  const [allChannels, allAdsAccounts, allProducts] = await Promise.all([
    getAllChannels(),
    getAllAdsAccounts(),
    getAllProducts(),
  ]);
  const selectedChannels = channelIds.length
    ? allChannels.filter((channel) => channelIds.includes(Number(channel.Id)))
    : allChannels;
  const selectedAdsAccounts = allAdsAccounts.filter((adsAccount) => {
    const matchesChannel =
      !channelIds.length || channelIds.includes(Number(adsAccount.channel_id));
    const matchesAccount =
      !adsAccountIds.length || adsAccountIds.includes(Number(adsAccount.Id));
    return matchesChannel && matchesAccount;
  });
  const selectedProducts = allProducts.filter((product) => {
    const matchesChannel =
      !channelIds.length || channelIds.includes(Number(product.channel_id));
    const matchesProduct = !productIds.length || productIds.includes(Number(product.Id));
    return matchesChannel && matchesProduct;
  });

  const entries = await getAllEntries(filters);
  const targets = await Target.findAll();
  const targetByChannel = new Map(targets.map((t) => [Number(t.channel_id), toPlain(t)]));
  const entriesByChannel = new Map();
  const entriesByAdsAccount = new Map();
  const entriesByProduct = new Map();
  entries.forEach((entry) => {
    const channelId = Number(entry.channel_id);
    const adsAccountId = Number(entry.ads_account_id || 0);
    const productId = Number(entry.product_id || 0);
    if (channelIds.length && !channelIds.includes(channelId)) return;
    if (adsAccountIds.length && !adsAccountIds.includes(adsAccountId)) return;
    if (productIds.length && !productIds.includes(productId)) return;
    entriesByChannel.set(channelId, [...(entriesByChannel.get(channelId) || []), entry]);
    if (adsAccountId && (!adsAccountIds.length || adsAccountIds.includes(adsAccountId))) {
      entriesByAdsAccount.set(adsAccountId, [...(entriesByAdsAccount.get(adsAccountId) || []), entry]);
    }
    if (productId && (!productIds.length || productIds.includes(productId))) {
      entriesByProduct.set(productId, [...(entriesByProduct.get(productId) || []), entry]);
    }
  });

  const channels = selectedChannels.map((channel) => {
    const plain = toPlain(channel);
    const target = getChannelTarget(targetByChannel, plain.Id);
    return {
      channel: plain,
      ...calculateSummary(entriesByChannel.get(Number(plain.Id)) || [], target),
    };
  });

  const adsAccounts = selectedAdsAccounts.map((adsAccount) => {
    const plain = toPlain(adsAccount);
    const target = getChannelTarget(targetByChannel, plain.channel_id);
    return {
      adsAccount: plain,
      ...calculateSummary(entriesByAdsAccount.get(Number(plain.Id)) || [], target),
    };
  });

  const products = selectedProducts.map((product) => {
    const plain = toPlain(product);
    const target = getChannelTarget(targetByChannel, plain.channel_id);
    return {
      product: plain,
      ...calculateSummary(entriesByProduct.get(Number(plain.Id)) || [], target),
    };
  });

  const best = channels.reduce(
    (winner, item) => (!winner || item.roas > winner.roas ? item : winner),
    null,
  );
  const lowestEfficiency = channels.reduce(
    (lowest, item) =>
      !lowest || item.revenue_per_usd < lowest.revenue_per_usd ? item : lowest,
    null,
  );

  const insights = [];
  if (best?.channel) {
    insights.push({
      tone: "green",
      text: `${best.channel.name} leads with ${best.roas}x ROAS - best performer.`,
    });
  }
  channels
    .filter((item) => item.is_over_target)
    .forEach((item) => {
      insights.push({
        tone: "red",
        text: `${item.channel.name} cost ${item.marketing_cost_percent}% exceeds target ${item.target_marketing_cost_percent}% by ${round2(item.marketing_cost_percent - item.target_marketing_cost_percent)}%.`,
      });
    });
  if (lowestEfficiency?.channel) {
    insights.push({
      tone: "yellow",
      text: `${lowestEfficiency.channel.name} has lowest USD efficiency at ${lowestEfficiency.revenue_per_usd} per $1 - review spend allocation.`,
    });
  }

  return { channels, adsAccounts, products, insights };
};

module.exports = {
  createChannel,
  getChannels,
  getAllChannels,
  updateChannel,
  deleteChannel,
  createAdsAccount,
  getAdsAccounts,
  getAllAdsAccounts,
  updateAdsAccount,
  deleteAdsAccount,
  createProduct,
  getProducts,
  getAllProducts,
  updateProduct,
  deleteProduct,
  createEntry,
  getEntries,
  getAllEntries,
  updateEntry,
  deleteEntry,
  getTargets,
  saveTargets,
  getDashboard,
  getCompare,
};

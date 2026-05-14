const { Op, fn, col } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  AdsCampaignKPISearchableFields,
} = require("./adsCampaignKPI.constants");

const AdsCampaignKPI = db.adsCampaignKPI;
const AdsAccount = db.adsAccount;

const platformOptions = ["Facebook", "Google", "Tiktok", "SEO"];
const numberFields = ["spend", "result", "confirm", "revenue"];

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : NaN;
};

const round2 = (value) => Number((Number(value) || 0).toFixed(2));

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const getDateBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const safeDivide = (numerator, denominator, multiplier = 1) => {
  const top = Number(numerator) || 0;
  const bottom = Number(denominator) || 0;
  if (!bottom) return 0;
  return round2((top / bottom) * multiplier);
};

const normalizePayload = (payload = {}) => {
  const campaignName = String(payload.campaignName || "").trim();
  const platform = String(payload.platform || "").trim();
  const adsAccountName = String(payload.adsAccountName || "").trim();
  const adsAccountId = payload.adsAccountId ? Number(payload.adsAccountId) : null;

  if (!platform) {
    throw new ApiError(400, "Platform is required");
  }

  if (!platformOptions.includes(platform)) {
    throw new ApiError(400, "Invalid platform");
  }

  const data = {
    campaignName:
      campaignName ||
      [platform, adsAccountName, payload.date || payload.startDate || getTodayDate()]
        .filter(Boolean)
        .join(" - "),
    platform,
    adsAccountId: Number.isFinite(adsAccountId) ? adsAccountId : null,
    adsAccountName: adsAccountName || null,
    date: payload.date || payload.startDate || getTodayDate(),
    note: payload.note || null,
    status: payload.status || "Active",
  };

  numberFields.forEach((field) => {
    const value = toNumber(payload[field]);
    if (Number.isNaN(value) || value < 0) {
      throw new ApiError(400, `${field} must be a positive number`);
    }
    data[field] = value;
  });

  return data;
};

const addCalculatedMetrics = (campaign = {}) => {
  const plain =
    typeof campaign.get === "function" ? campaign.get({ plain: true }) : campaign;
  const spend = toNumber(plain.spend);
  const revenue = toNumber(plain.revenue);
  const result = toNumber(plain.result ?? plain.conversions);
  const confirm = toNumber(plain.confirm);
  const profit = round2(revenue - spend);
  const loss = round2(Math.max(spend - revenue, 0));
  const roas = safeDivide(revenue, spend);
  const roi = safeDivide(profit, spend, 100);

  let rating = "Poor";
  if (roas >= 4 || roi >= 150) rating = "Excellent";
  else if (roas >= 2.5 || roi >= 75) rating = "Good";
  else if (roas >= 1 || roi >= 0) rating = "Average";

  return {
    ...plain,
    date: plain.date,
    result,
    confirm,
    completedOrder: confirm,
    cpr: safeDivide(spend, result),
    costPerCompletedOrder: safeDivide(spend, confirm),
    revenuePerCompletedOrder: safeDivide(revenue, confirm),
    confirmRate: safeDivide(confirm, result, 100),
    roas,
    roi,
    profit,
    loss,
    rating,
  };
};

const buildWhereConditions = (filters = {}) => {
  const { searchTerm, date, startDate, endDate, ...otherFilters } = filters;
  const andConditions = [];

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();
    andConditions.push({
      [Op.or]: AdsCampaignKPISearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

  if (date) {
    const bounds = getDateBounds(date);
    andConditions.push({
      [Op.or]: [
        { date: { [Op.eq]: date } },
        {
          date: { [Op.is]: null },
          createdAt: { [Op.between]: [bounds.start, bounds.end] },
        },
      ],
    });
  } else if (startDate && endDate) {
    const startBounds = getDateBounds(startDate);
    const endBounds = getDateBounds(endDate);
    andConditions.push({
      [Op.or]: [
        { date: { [Op.between]: [startDate, endDate] } },
        {
          date: { [Op.is]: null },
          createdAt: { [Op.between]: [startBounds.start, endBounds.end] },
        },
      ],
    });
  } else if (startDate) {
    const bounds = getDateBounds(startDate);
    andConditions.push({
      [Op.or]: [
        { date: { [Op.gte]: startDate } },
        {
          date: { [Op.is]: null },
          createdAt: { [Op.gte]: bounds.start },
        },
      ],
    });
  } else if (endDate) {
    const bounds = getDateBounds(endDate);
    andConditions.push({
      [Op.or]: [
        { date: { [Op.lte]: endDate } },
        {
          date: { [Op.is]: null },
          createdAt: { [Op.lte]: bounds.end },
        },
      ],
    });
  }

  return andConditions.length ? { [Op.and]: andConditions } : {};
};

const getSummaryFromRows = (rows = []) => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.spend += toNumber(row.spend);
      acc.result += toNumber(row.result ?? row.conversions);
      acc.confirm += toNumber(row.confirm);
      acc.revenue += toNumber(row.revenue);
      return acc;
    },
    {
      spend: 0,
      result: 0,
      confirm: 0,
      revenue: 0,
    },
  );

  return addCalculatedMetrics(totals);
};

const insertIntoDB = async (payload) => {
  const result = await AdsCampaignKPI.create(normalizePayload(payload));
  return addCalculatedMetrics(result);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const whereConditions = buildWhereConditions(filters);
  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, String(options.sortOrder).toUpperCase()]]
      : [["date", "DESC"]];

  const [rows, count, allRows] = await Promise.all([
    AdsCampaignKPI.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order,
    }),
    AdsCampaignKPI.count({ where: whereConditions }),
    AdsCampaignKPI.findAll({
      where: whereConditions,
      attributes: numberFields,
      raw: true,
      paranoid: true,
    }),
  ]);

  return {
    meta: {
      count,
      page,
      limit,
      summary: getSummaryFromRows(allRows),
    },
    data: rows.map(addCalculatedMetrics),
  };
};

const getDataById = async (id) => {
  const result = await AdsCampaignKPI.findOne({
    where: { Id: id },
  });

  return result ? addCalculatedMetrics(result) : null;
};

const updateOneFromDB = async (id, payload) => {
  const existing = await AdsCampaignKPI.findByPk(id);
  if (!existing) {
    throw new ApiError(404, "Ads Campaign KPI not found");
  }

  await existing.update(normalizePayload({ ...existing.get({ plain: true }), ...payload }));
  return addCalculatedMetrics(existing);
};

const deleteIdFromDB = async (id) => {
  return AdsCampaignKPI.destroy({ where: { Id: id } });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await AdsCampaignKPI.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result.map(addCalculatedMetrics);
};

const getSummary = async (filters) => {
  const rows = await AdsCampaignKPI.findAll({
    where: buildWhereConditions(filters),
    attributes: numberFields,
    raw: true,
    paranoid: true,
  });

  return getSummaryFromRows(rows);
};

const getPerformanceGraph = async (filters) => {
  const whereConditions = buildWhereConditions(filters);
  const rows = await AdsCampaignKPI.findAll({
    where: whereConditions,
    attributes: [
      "date",
      [fn("SUM", col("spend")), "spend"],
      [fn("SUM", col("revenue")), "revenue"],
      [fn("SUM", col("result")), "result"],
      [fn("SUM", col("confirm")), "confirm"],
    ],
    group: ["date"],
    order: [["date", "ASC"]],
    raw: true,
    paranoid: true,
  });

  return rows.map((row, index) => {
    const current = addCalculatedMetrics(row);
    const previous = index > 0 ? addCalculatedMetrics(rows[index - 1]) : null;
    const roasDelta = previous ? round2(current.roas - previous.roas) : 0;
    const revenueDelta = previous ? round2(current.revenue - previous.revenue) : 0;

    return {
      ...current,
      date: row.date,
      roasDelta,
      revenueDelta,
      trend:
        roasDelta > 0 ? "up" : roasDelta < 0 ? "down" : previous ? "same" : "new",
    };
  });
};

const normalizeAdsAccountPayload = (payload = {}) => {
  const platform = String(payload.platform || "").trim();
  const accountName = String(payload.accountName || payload.name || "").trim();

  if (!platformOptions.includes(platform)) {
    throw new ApiError(400, "Invalid platform");
  }

  if (!accountName) {
    throw new ApiError(400, "Ads account name is required");
  }

  return {
    platform,
    accountName,
    status: payload.status || "Active",
  };
};

const createAdsAccount = async (payload) => {
  const data = normalizeAdsAccountPayload(payload);
  const [account] = await AdsAccount.findOrCreate({
    where: {
      platform: data.platform,
      accountName: data.accountName,
    },
    defaults: data,
  });

  return account;
};

const getAdsAccounts = async (filters = {}) => {
  const where = {};
  if (filters.platform) where.platform = filters.platform;

  return AdsAccount.findAll({
    where,
    paranoid: true,
    order: [
      ["platform", "ASC"],
      ["accountName", "ASC"],
    ],
  });
};

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getSummary,
  getPerformanceGraph,
  createAdsAccount,
  getAdsAccounts,
};

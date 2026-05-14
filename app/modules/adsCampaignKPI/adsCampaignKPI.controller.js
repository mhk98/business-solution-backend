const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const AdsCampaignKPIService = require("./adsCampaignKPI.service");
const {
  AdsCampaignKPIFilterAbleFields,
} = require("./adsCampaignKPI.constants");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await AdsCampaignKPIService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI created successfully!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, AdsCampaignKPIFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await AdsCampaignKPIService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI data fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await AdsCampaignKPIService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI data fetched successfully!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await AdsCampaignKPIService.updateOneFromDB(
    req.params.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI updated successfully!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await AdsCampaignKPIService.deleteIdFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI deleted successfully!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await AdsCampaignKPIService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI data fetched successfully!",
    data: result,
  });
});

const getSummary = catchAsync(async (req, res) => {
  const filters = pick(req.query, AdsCampaignKPIFilterAbleFields);
  const result = await AdsCampaignKPIService.getSummary(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI summary fetched successfully!",
    data: result,
  });
});

const getPerformanceGraph = catchAsync(async (req, res) => {
  const filters = pick(req.query, AdsCampaignKPIFilterAbleFields);
  const result = await AdsCampaignKPIService.getPerformanceGraph(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads Campaign KPI performance graph fetched successfully!",
    data: result,
  });
});

const createAdsAccount = catchAsync(async (req, res) => {
  const result = await AdsCampaignKPIService.createAdsAccount(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads account created successfully!",
    data: result,
  });
});

const getAdsAccounts = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["platform"]);
  const result = await AdsCampaignKPIService.getAdsAccounts(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Ads account data fetched successfully!",
    data: result,
  });
});

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

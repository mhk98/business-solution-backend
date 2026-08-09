const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const service = require("./performanceTracker.service");

const channelFilters = ["searchTerm"];
const childFilters = ["channel_id", "searchTerm"];
const entryFilters = ["channel_id", "ads_account_id", "product_id", "startDate", "endDate", "searchTerm"];
const optionsFields = ["limit", "page", "sortBy", "sortOrder"];

const createChannel = catchAsync(async (req, res) => {
  const result = await service.createChannel(req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker channel created successfully!",
    data: result,
  });
});

const getChannels = catchAsync(async (req, res) => {
  const result = await service.getChannels(
    pick(req.query, channelFilters),
    pick(req.query, optionsFields),
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker channels fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getAllChannels = catchAsync(async (_req, res) => {
  const result = await service.getAllChannels();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker channels fetched successfully!",
    data: result,
  });
});

const updateChannel = catchAsync(async (req, res) => {
  const result = await service.updateChannel(req.params.id, req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker channel updated successfully!",
    data: result,
  });
});

const deleteChannel = catchAsync(async (req, res) => {
  const result = await service.deleteChannel(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker channel deleted successfully!",
    data: result,
  });
});

const createAdsAccount = catchAsync(async (req, res) => {
  const result = await service.createAdsAccount(req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker ads account created successfully!",
    data: result,
  });
});

const getAdsAccounts = catchAsync(async (req, res) => {
  const result = await service.getAdsAccounts(
    pick(req.query, childFilters),
    pick(req.query, optionsFields),
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker ads accounts fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getAllAdsAccounts = catchAsync(async (req, res) => {
  const result = await service.getAllAdsAccounts(pick(req.query, childFilters));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker ads accounts fetched successfully!",
    data: result,
  });
});

const updateAdsAccount = catchAsync(async (req, res) => {
  const result = await service.updateAdsAccount(req.params.id, req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker ads account updated successfully!",
    data: result,
  });
});

const deleteAdsAccount = catchAsync(async (req, res) => {
  const result = await service.deleteAdsAccount(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker ads account deleted successfully!",
    data: result,
  });
});

const createProduct = catchAsync(async (req, res) => {
  const result = await service.createProduct(req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker product created successfully!",
    data: result,
  });
});

const getProducts = catchAsync(async (req, res) => {
  const result = await service.getProducts(
    pick(req.query, childFilters),
    pick(req.query, optionsFields),
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker products fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getAllProducts = catchAsync(async (req, res) => {
  const result = await service.getAllProducts(pick(req.query, childFilters));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker products fetched successfully!",
    data: result,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const result = await service.updateProduct(req.params.id, req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker product updated successfully!",
    data: result,
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const result = await service.deleteProduct(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker product deleted successfully!",
    data: result,
  });
});

const createEntry = catchAsync(async (req, res) => {
  const result = await service.createEntry(req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker entry created successfully!",
    data: result,
  });
});

const getEntries = catchAsync(async (req, res) => {
  const result = await service.getEntries(
    pick(req.query, entryFilters),
    pick(req.query, optionsFields),
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker entries fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getAllEntries = catchAsync(async (req, res) => {
  const result = await service.getAllEntries(pick(req.query, entryFilters));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker entries fetched successfully!",
    data: result,
  });
});

const updateEntry = catchAsync(async (req, res) => {
  const result = await service.updateEntry(req.params.id, req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker entry updated successfully!",
    data: result,
  });
});

const deleteEntry = catchAsync(async (req, res) => {
  const result = await service.deleteEntry(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker entry deleted successfully!",
    data: result,
  });
});

const getTargets = catchAsync(async (_req, res) => {
  const result = await service.getTargets();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker targets fetched successfully!",
    data: result,
  });
});

const saveTargets = catchAsync(async (req, res) => {
  const result = await service.saveTargets(req.body?.targets || [], req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker targets saved successfully!",
    data: result,
  });
});

const getDashboard = catchAsync(async (req, res) => {
  const result = await service.getDashboard(pick(req.query, entryFilters));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker dashboard fetched successfully!",
    data: result,
  });
});

const getCompare = catchAsync(async (req, res) => {
  const result = await service.getCompare(
    pick(req.query, [...entryFilters, "channel_ids", "ads_account_ids", "product_ids"]),
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Performance tracker comparison fetched successfully!",
    data: result,
  });
});

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

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const LedgerHistoryService = require("./ledgerHistory.service");
const { LedgerHistoryFilterAbleFields } = require("./ledgerHistory.constants");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await LedgerHistoryService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "LedgerHistory data created successfully!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, LedgerHistoryFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await LedgerHistoryService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "LedgerHistory data fetched successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await LedgerHistoryService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "LedgerHistory data fetched successfully!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await LedgerHistoryService.updateOneFromDB(id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "LedgerHistory updated successfully!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await LedgerHistoryService.deleteIdFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "LedgerHistory deleted successfully!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await LedgerHistoryService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "LedgerHistory data fetched successfully!",
    data: result,
  });
});

const LedgerHistoryController = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = LedgerHistoryController;

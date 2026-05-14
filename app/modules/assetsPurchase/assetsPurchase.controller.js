const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  AssetsPurchaseFilterAbleFileds,
} = require("./assetsPurchase.constants");
const AssetsPurchaseService = require("./assetsPurchase.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await AssetsPurchaseService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "AssetsPurchase data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, AssetsPurchaseFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await AssetsPurchaseService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assets purchase data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await AssetsPurchaseService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "AssetsPurchase data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await AssetsPurchaseService.updateOneFromDB(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "AssetsPurchase update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await AssetsPurchaseService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "AssetsPurchase delete successfully!!",
    data: result,
  });
});

// const removeIdFromDB = catchAsync(async (req, res) => {
//   const result = await AssetsPurchaseService.deleteIdFromDB(req.params.id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "AssetsPurchase delete successfully!!",
//     data: result,
//   });
// });

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await AssetsPurchaseService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "AssetsPurchase data fetch!!",
    data: result,
  });
});

const AssetsPurchaseController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = AssetsPurchaseController;

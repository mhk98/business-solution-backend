const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");

const {
  InventoryMasterFilterAbleFileds,
} = require("./inventoryMaster.constants");
const InventoryMasterService = require("./inventoryMaster.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await InventoryMasterService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "InventoryMaster data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, InventoryMasterFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await InventoryMasterService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "inventory Master data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await InventoryMasterService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "InventoryMaster data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await InventoryMasterService.updateOneFromDB(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "InventoryMaster update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await InventoryMasterService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "InventoryMaster delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await InventoryMasterService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "InventoryMaster data fetch!!",
    data: result,
  });
});

const getLowStockProducts = catchAsync(async (req, res) => {
  const result = await InventoryMasterService.getLowStockProductsFromDB();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Low stock products fetched!!",
    data: result,
  });
});

const InventoryMasterController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getLowStockProducts,
};

module.exports = InventoryMasterController;

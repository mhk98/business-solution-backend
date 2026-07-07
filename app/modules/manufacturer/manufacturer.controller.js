const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { ManufacturerFilterAbleFileds } = require("./manufacturer.constants");
const ManufacturerService = require("./manufacturer.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await ManufacturerService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ManufacturerFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await ManufacturerService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ManufacturerService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await ManufacturerService.updateOneFromDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ManufacturerService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await ManufacturerService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer data fetch!!",
    data: result,
  });
});

const getTransactionHistory = catchAsync(async (req, res) => {
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ManufacturerService.getTransactionHistory(
    req.params.id,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer transaction history fetched!!",
    meta: result.meta,
    summary: result.summary,
    manufacturer: result.manufacturer,
    data: result.data,
  });
});

const payManufacturerAmount = catchAsync(async (req, res) => {
  const result = await ManufacturerService.payManufacturerAmount(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacturer payment saved!!",
    data: result,
  });
});

const ManufacturerController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getTransactionHistory,
  payManufacturerAmount,
};

module.exports = ManufacturerController;

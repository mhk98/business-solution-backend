const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { DollarSupplierFilterAbleFileds } = require("./dollarSupplier.constants");
const DollarSupplierService = require("./dollarSupplier.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await DollarSupplierService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dollar Supplier data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, DollarSupplierFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await DollarSupplierService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dollar Supplier data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await DollarSupplierService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dollar Supplier data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await DollarSupplierService.updateOneFromDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dollar Supplier update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await DollarSupplierService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dollar Supplier delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await DollarSupplierService.getAllFromDBWithoutQuery(
    pick(req.query, ["startDate", "endDate"]),
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dollar Supplier data fetch!!",
    data: result,
  });
});

const DollarSupplierController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = DollarSupplierController;

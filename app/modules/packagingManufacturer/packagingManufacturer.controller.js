const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  PackagingManufacturerFilterAbleFileds,
} = require("./packagingManufacturer.constants");
const PackagingManufacturerService = require("./packagingManufacturer.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await PackagingManufacturerService.insertIntoDB(req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging manufacturer created!!", data: result });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PackagingManufacturerFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await PackagingManufacturerService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging manufacturer fetched!!", meta: result.meta, data: result.data });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PackagingManufacturerService.getDataById(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging manufacturer fetched!!", data: result });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await PackagingManufacturerService.updateOneFromDB(req.params.id, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging manufacturer updated!!", data: result });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PackagingManufacturerService.deleteIdFromDB(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging manufacturer deleted!!", data: result });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PackagingManufacturerService.getAllFromDBWithoutQuery();
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging manufacturer fetch!!", data: result });
});

const payManufacturerAmount = catchAsync(async (req, res) => {
  const result = await PackagingManufacturerService.payManufacturerAmount(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Packaging manufacturer payment added!!",
    data: result,
  });
});

module.exports = { getAllFromDB, insertIntoDB, getDataById, updateOneFromDB, deleteIdFromDB, getAllFromDBWithoutQuery, payManufacturerAmount };

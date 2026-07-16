const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { PackagingFactoryFilterAbleFileds } = require("./packagingFactory.constants");
const PackagingFactoryService = require("./packagingFactory.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await PackagingFactoryService.insertIntoDB(req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging factory data created!!", data: result });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PackagingFactoryFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await PackagingFactoryService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging factory data fetched!!", meta: result.meta, data: result.data });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await PackagingFactoryService.updateOneFromDB(req.params.id, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging factory updated!!", data: result });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PackagingFactoryService.deleteIdFromDB(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging factory deleted!!", data: result });
});

module.exports = { getAllFromDB, insertIntoDB, updateOneFromDB, deleteIdFromDB };

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { PackagingMixerFilterAbleFileds } = require("./packagingMixer.constants");
const PackagingMixerService = require("./packagingMixer.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await PackagingMixerService.insertIntoDB(req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging mixer created!!", data: result });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PackagingMixerFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await PackagingMixerService.getAllFromDB(filters, options);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging mixer fetched!!", meta: result.meta, data: result.data });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await PackagingMixerService.updateOneFromDB(req.params.id, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging mixer updated!!", data: result });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PackagingMixerService.deleteIdFromDB(req.params.id);
  sendResponse(res, { statusCode: 200, success: true, message: "Packaging mixer deleted!!", data: result });
});

module.exports = { getAllFromDB, insertIntoDB, updateOneFromDB, deleteIdFromDB };

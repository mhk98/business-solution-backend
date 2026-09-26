const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { MixerFilterAbleFileds } = require("../mixer/mixer.constants");
const ComboProductionService = require("./comboProduction.service");

const getCombos = catchAsync(async (req, res) => {
  const result = await ComboProductionService.getCombos();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Combos fetched!!",
    data: result,
  });
});

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await ComboProductionService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Combo production added to stock!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, MixerFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ComboProductionService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Combo production fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ComboProductionService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Combo production deleted!!",
    data: result,
  });
});

module.exports = {
  getCombos,
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
};

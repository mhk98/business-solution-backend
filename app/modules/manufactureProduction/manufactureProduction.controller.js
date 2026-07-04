const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  ManufactureProductionFilterAbleFileds,
} = require("./manufactureProduction.constants");
const ManufactureProductionService = require("./manufactureProduction.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await ManufactureProductionService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacture data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ManufactureProductionFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await ManufactureProductionService.getAllFromDB(
    filters,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacture data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ManufactureProductionService.deleteIdFromDB(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacture delete successfully!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await ManufactureProductionService.updateOneFromDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Manufacture update successfully!!",
    data: result,
  });
});

const ManufactureProductionController = {
  insertIntoDB,
  getAllFromDB,
  deleteIdFromDB,
  updateOneFromDB,
};

module.exports = ManufactureProductionController;

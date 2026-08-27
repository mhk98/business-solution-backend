const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  DirectorProfitShareFilterAbleFields,
} = require("./directorProfitShare.constants");
const DirectorProfitShareService = require("./directorProfitShare.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await DirectorProfitShareService.insertIntoDB(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Director profit share created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, DirectorProfitShareFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await DirectorProfitShareService.getAllFromDB(
    filters,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Director profit share data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await DirectorProfitShareService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Director profit share data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await DirectorProfitShareService.updateOneFromDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Director profit share update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await DirectorProfitShareService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Director profit share delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await DirectorProfitShareService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Director profit share data fetch!!",
    data: result,
  });
});

module.exports = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ShifaIncentiveService = require("./shifaIncentive.service");
const { ShifaIncentiveFilterableFields } = require("./shifaIncentive.constants");

const createIncentive = catchAsync(async (req, res) => {
  const result = await ShifaIncentiveService.createIncentive(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Incentive created successfully",
    data: result,
  });
});

const getAllIncentives = catchAsync(async (req, res) => {
  const filters = pick(req.query, ShifaIncentiveFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await ShifaIncentiveService.getAllIncentives(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Incentives fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ShifaIncentiveService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Incentive fetched successfully",
    data: result,
  });
});

const updateIncentive = catchAsync(async (req, res) => {
  const result = await ShifaIncentiveService.updateIncentive(req.params.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Incentive updated successfully",
    data: result,
  });
});

const deleteIncentive = catchAsync(async (req, res) => {
  const result = await ShifaIncentiveService.deleteIncentive(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Incentive deleted successfully",
    data: result,
  });
});

module.exports = {
  createIncentive,
  getAllIncentives,
  getDataById,
  updateIncentive,
  deleteIncentive,
};

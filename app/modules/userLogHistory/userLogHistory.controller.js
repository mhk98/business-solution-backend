const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const { UserLogHistoryFilterableFields } = require("./userLogHistory.constants");
const UserLogHistoryService = require("./userLogHistory.service");

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, UserLogHistoryFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);

  const result = await UserLogHistoryService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User log history fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await UserLogHistoryService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User log history fetched successfully",
    data: result,
  });
});

const UserLogHistoryController = {
  getAllFromDB,
  getDataById,
};

module.exports = UserLogHistoryController;

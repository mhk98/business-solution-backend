const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const CourierBalanceService = require("./courierBalance.service");
const { CourierBalanceFilterAbleFields } = require("./courierBalance.constants");

const respond = (res, message, result, meta) =>
  sendResponse(res, { statusCode: 200, success: true, message, meta, data: result });

const insertIntoDB = catchAsync(async (req, res) => {
  respond(res, "Courier balance created!!", await CourierBalanceService.insertIntoDB(req.body));
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, CourierBalanceFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await CourierBalanceService.getAllFromDB(filters, options);
  respond(res, "Courier balance fetched!!", result.data, result.meta);
});

const getDataById = catchAsync(async (req, res) => {
  respond(res, "Courier balance fetched!!", await CourierBalanceService.getDataById(req.params.id));
});

const updateOneFromDB = catchAsync(async (req, res) => {
  respond(
    res,
    "Courier balance updated!!",
    await CourierBalanceService.updateOneFromDB(req.params.id, req.body),
  );
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  respond(res, "Courier balance deleted!!", await CourierBalanceService.deleteIdFromDB(req.params.id));
});

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
};

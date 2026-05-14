const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ApiError = require("../../../error/ApiError");
const { ProfitLossFilterAbleFileds } = require("./profitLoss.constants");
const ProfitLossService = require("./profitLoss.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await ProfitLossService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfitLoss data created!!",
    data: result,
  });
});

const sendInvoiceEmail = catchAsync(async (req, res) => {
  const result = await ProfitLossService.sendInvoiceEmail(req.body);

  if (!result) {
    throw new ApiError(400, "Invoice email could not be sent");
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Invoice email sent!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ProfitLossFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await ProfitLossService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profit loss data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ProfitLossService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfitLoss data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProfitLossService.updateOneFromDB(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfitLoss update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ProfitLossService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfitLoss delete successfully!!",
    data: result,
  });
});

// const removeIdFromDB = catchAsync(async (req, res) => {
//   const result = await ProfitLossService.deleteIdFromDB(req.params.id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "ProfitLoss delete successfully!!",
//     data: result,
//   });
// });

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await ProfitLossService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfitLoss data fetch!!",
    data: result,
  });
});

const ProfitLossController = {
  getAllFromDB,
  insertIntoDB,
  sendInvoiceEmail,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = ProfitLossController;

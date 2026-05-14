const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ReceivedProductService = require("./receivedProduct.service");
const {
  ReceivedProductFilterAbleFileds,
} = require("./receivedProduct.constants");

const insertIntoDB = catchAsync(async (req, res) => {
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const result = await ReceivedProductService.insertIntoDB(req.body, file);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ReceivedProduct data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ReceivedProductFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await ReceivedProductService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Received product data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ReceivedProductService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ReceivedProduct data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;

  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const data = {
    ...req.body,
    file,
  };
  const result = await ReceivedProductService.updateOneFromDB(id, data);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ReceivedProduct update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ReceivedProductService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ReceivedProduct delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await ReceivedProductService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ReceivedProduct data fetch!!",
    data: result,
  });
});

const ReceivedProductController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = ReceivedProductController;

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const LogoService = require("./logo.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const data = {
    file: req.file === undefined ? undefined : req.file.path,
  };

  const result = await LogoService.insertIntoDB(data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logo data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const result = await LogoService.getAllFromDB();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logo data fetched!!",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await LogoService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logo data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = {
    file: req.file === undefined ? undefined : req.file.path,
  };
  const result = await LogoService.updateOneFromDB(id, data);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logo update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await LogoService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logo delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await LogoService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Logo data fetch!!",
    data: result,
  });
});

const LogoController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = LogoController;

const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const CompanyInfoService = require("./companyInfo.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const { address, hotline, website, email, whatsapp } = req.body;
  const data = { address, hotline, website, email, whatsapp };

  const result = await CompanyInfoService.insertIntoDB(data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Company info created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const result = await CompanyInfoService.getAllFromDB();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Company info fetched!!",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await CompanyInfoService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Company info fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { address, hotline, website, email, whatsapp } = req.body;
  const data = { address, hotline, website, email, whatsapp };

  const result = await CompanyInfoService.updateOneFromDB(id, data);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Company info updated successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await CompanyInfoService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Company info deleted successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await CompanyInfoService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Company info fetch!!",
    data: result,
  });
});

const CompanyInfoController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = CompanyInfoController;

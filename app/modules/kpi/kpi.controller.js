const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const {
  KPIFilterAbleFileds,
  KPIEmployeeOptionFilterAbleFields,
} = require("./kpi.constants");
const KPIService = require("./kpi.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await KPIService.insertIntoDB(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, KPIFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await KPIService.getAllFromDB(filters, options, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await KPIService.getDataById(req.params.id, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await KPIService.updateOneFromDB(id, req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await KPIService.deleteIdFromDB(req.params.id, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI delete successfully!!",
    data: result,
  });
});

// const removeIdFromDB = catchAsync(async (req, res) => {
//   const result = await KPIService.deleteIdFromDB(req.params.id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "KPI delete successfully!!",
//     data: result,
//   });
// });

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await KPIService.getAllFromDBWithoutQuery(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI data fetch!!",
    data: result,
  });
});

const getPerformanceGraph = catchAsync(async (req, res) => {
  const filters = pick(req.query, KPIFilterAbleFileds);
  const result = await KPIService.getPerformanceGraph(filters, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI performance graph fetched!!",
    data: result,
  });
});

const getEmployeeOptions = catchAsync(async (req, res) => {
  const filters = pick(req.query, KPIEmployeeOptionFilterAbleFields);
  const options = pick(req.query, ["limit", "page"]);
  const result = await KPIService.getEmployeeOptions(filters, options, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI employee options fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getKPISettings = catchAsync(async (req, res) => {
  const result = await KPIService.getKPISettings();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI settings fetched!!",
    data: result,
  });
});

const updateKPISettings = catchAsync(async (req, res) => {
  const result = await KPIService.updateKPISettings(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "KPI settings updated successfully!!",
    data: result,
  });
});

const KPIController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getPerformanceGraph,
  getEmployeeOptions,
  getKPISettings,
  updateKPISettings,
};

module.exports = KPIController;

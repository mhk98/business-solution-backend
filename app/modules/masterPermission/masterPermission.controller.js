const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const MasterPermissionService = require("./masterPermission.service");

const getSelfPermission = catchAsync(async (req, res) => {
  const result = await MasterPermissionService.getSelfPermission(req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Master permission checked successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  await MasterPermissionService.assertMasterUser(req.user);
  const result = await MasterPermissionService.getAllFromDB();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Master permissions retrieved successfully",
    data: result,
  });
});

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await MasterPermissionService.insertIntoDB(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Master permission added successfully",
    data: result,
  });
});

const deleteFromDB = catchAsync(async (req, res) => {
  const result = await MasterPermissionService.deleteFromDB(req.params.id, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Master permission removed successfully",
    data: result,
  });
});

module.exports = {
  getSelfPermission,
  getAllFromDB,
  insertIntoDB,
  deleteFromDB,
};

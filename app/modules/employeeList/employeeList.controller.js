const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");

const { EmployeeListFilterAbleFileds } = require("./employeeList.constants");
const EmployeeListService = require("./employeeList.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await EmployeeListService.insertIntoDB(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Employee record submitted for approval"
        : "EmployeeList data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, EmployeeListFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await EmployeeListService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee list data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await EmployeeListService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "EmployeeList data fetched!!",
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const result = await EmployeeListService.getProfileByUserId(req.user.Id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Employee profile fetched successfully!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await EmployeeListService.updateOneFromDB(id, req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Employee update submitted for approval"
        : "EmployeeList update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await EmployeeListService.deleteIdFromDB(
    req.params.id,
    req.user,
    req.body?.note,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "delete_requested"
        ? "Employee delete request submitted for approval"
        : "EmployeeList delete successfully!!",
    data: result,
  });
});

const approveOneFromDB = catchAsync(async (req, res) => {
  const result = await EmployeeListService.approveOneFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "deleted"
        ? "Pending delete request completed successfully"
        : "Employee approved successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await EmployeeListService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "EmployeeList data fetch!!",
    data: result,
  });
});

const EmployeeListController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  getMyProfile,
  updateOneFromDB,
  deleteIdFromDB,
  approveOneFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = EmployeeListController;

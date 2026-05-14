const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { DepartmentFilterAbleFields } = require("./department.constants");
const DepartmentService = require("./department.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await DepartmentService.insertIntoDB(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Department submitted for approval"
        : "Department created successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, DepartmentFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await DepartmentService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Departments fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await DepartmentService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Departments fetched successfully",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await DepartmentService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Department fetched successfully",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await DepartmentService.updateOneFromDB(
    req.params.id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Department update submitted for approval"
        : "Department updated successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await DepartmentService.deleteIdFromDB(
    req.params.id,
    req.user,
    req.body?.note,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "delete_requested"
        ? "Department delete request submitted for approval"
        : "Department deleted successfully",
    data: result,
  });
});

const approveOneFromDB = catchAsync(async (req, res) => {
  const result = await DepartmentService.approveOneFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "deleted"
        ? "Pending delete request completed successfully"
        : "Department approved successfully",
    data: result,
  });
});

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  approveOneFromDB,
};

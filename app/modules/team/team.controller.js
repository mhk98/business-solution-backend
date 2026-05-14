const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { TeamFilterAbleFields } = require("./team.constants");
const TeamService = require("./team.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await TeamService.insertIntoDB(req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Team submitted for approval"
        : "Team created successfully",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, TeamFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await TeamService.getAllFromDB(filters, options);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Teams fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await TeamService.getAllFromDBWithoutQuery();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Teams fetched successfully",
    data: result,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await TeamService.getDataById(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Team fetched successfully",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const result = await TeamService.updateOneFromDB(
    req.params.id,
    req.body,
    req.user,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.status === "Pending"
        ? "Team update submitted for approval"
        : "Team updated successfully",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await TeamService.deleteIdFromDB(
    req.params.id,
    req.user,
    req.body?.note,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "delete_requested"
        ? "Team delete request submitted for approval"
        : "Team deleted successfully",
    data: result,
  });
});

const approveOneFromDB = catchAsync(async (req, res) => {
  const result = await TeamService.approveOneFromDB(req.params.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message:
      result?.workflowAction === "deleted"
        ? "Pending delete request completed successfully"
        : "Team approved successfully",
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

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const TaskService = require("./task.service");

const createTask = catchAsync(async (req, res) => {
  const result = await TaskService.createTask(req.body, req.user);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Task assigned successfully",
    data: result,
  });
});

const getTasks = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["searchTerm", "status", "assignedToUserId"]);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await TaskService.getTasks(filters, options, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Tasks fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const updateTask = catchAsync(async (req, res) => {
  const result = await TaskService.updateTask(req.params.id, req.body, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Task updated successfully",
    data: result,
  });
});

const deleteTask = catchAsync(async (req, res) => {
  const result = await TaskService.deleteTask(req.params.id, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Task deleted successfully",
    data: result,
  });
});

const getAssignableUsers = catchAsync(async (req, res) => {
  const result = await TaskService.getAssignableUsers();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assignable users fetched successfully",
    data: result,
  });
});

module.exports = {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getAssignableUsers,
};

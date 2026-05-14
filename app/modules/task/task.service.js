const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const Task = db.task;
const User = db.user;
const Notification = db.notification;

const MANAGER_ROLES = ["superAdmin", "admin"];
const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"];

const isManager = (role) => MANAGER_ROLES.includes(role);

const getTaskVisibilityCondition = (actor) => {
  const actorId = Number(actor?.Id);

  return {
    [Op.or]: [{ assignedToUserId: actorId }, { assignedByUserId: actorId }],
  };
};

const canAccessTask = (task, actor) => {
  const actorId = Number(actor?.Id);
  return (
    Number(task.assignedToUserId) === actorId ||
    Number(task.assignedByUserId) === actorId
  );
};

const normalizeOption = (value, allowed, fallback) => {
  const text = String(value || "").trim();
  return allowed.includes(text) ? text : fallback;
};

const getUserName = (user) =>
  `${user?.FirstName || ""} ${user?.LastName || ""}`.trim() ||
  user?.Email ||
  "Management";

const getAssignableUsers = async () => {
  return User.findAll({
    attributes: ["Id", "FirstName", "LastName", "Email", "role", "status"],
    where: {
      deletedAt: { [Op.is]: null },
      status: { [Op.ne]: "Inactive" },
    },
    order: [
      ["FirstName", "ASC"],
      ["Email", "ASC"],
    ],
  });
};

const getTaskById = async (id) => {
  return Task.findOne({
    where: { Id: id },
    include: [
      {
        model: User,
        as: "assignedTo",
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
      },
      {
        model: User,
        as: "assignedBy",
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
      },
    ],
  });
};

const createTask = async (payload, actor) => {
  if (!isManager(actor?.role)) {
    throw new ApiError(403, "Only admin or super admin can assign tasks");
  }

  const title = String(payload?.title || "").trim();
  const assignedToUserId = Number(payload?.assignedToUserId);

  if (!title) {
    throw new ApiError(400, "Task title is required");
  }
  if (!assignedToUserId) {
    throw new ApiError(400, "Assigned user is required");
  }

  const assignee = await User.findOne({
    where: { Id: assignedToUserId, deletedAt: { [Op.is]: null } },
    attributes: ["Id", "FirstName", "LastName", "Email", "status"],
  });

  if (!assignee) {
    throw new ApiError(404, "Assigned user not found");
  }
  if (assignee.status === "Inactive") {
    throw new ApiError(400, "Cannot assign task to inactive user");
  }

  const task = await Task.create({
    title,
    description: String(payload?.description || "").trim() || null,
    assignedToUserId,
    assignedByUserId: actor.Id,
    priority: normalizeOption(payload?.priority, TASK_PRIORITIES, "Normal"),
    status: "Pending",
    dueDate: payload?.dueDate || null,
  });

  await Notification.create({
    userId: assignedToUserId,
    url: `/${process.env.APP_BASE_URL}/tasks`,
    message: `New task assigned by ${getUserName(actor)}: ${title}`,
  });

  return getTaskById(task.Id);
};

const getTasks = async (filters, options, actor) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, status, assignedToUserId } = filters || {};
  const andConditions = [
    { deletedAt: { [Op.is]: null } },
    getTaskVisibilityCondition(actor),
  ];

  if (assignedToUserId) {
    andConditions.push({ assignedToUserId });
  }

  if (status) {
    andConditions.push({ status });
  }

  if (searchTerm && searchTerm.trim()) {
    const value = `%${searchTerm.trim()}%`;
    andConditions.push({
      [Op.or]: [
        { title: { [Op.like]: value } },
        { description: { [Op.like]: value } },
      ],
    });
  }

  const where = { [Op.and]: andConditions };
  const data = await Task.findAll({
    where,
    offset: skip,
    limit,
    include: [
      {
        model: User,
        as: "assignedTo",
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
      },
      {
        model: User,
        as: "assignedBy",
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  const count = await Task.count({ where });

  return { meta: { count, page, limit }, data };
};

const updateTask = async (id, payload, actor) => {
  const task = await Task.findOne({ where: { Id: id } });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const canUpdate = canAccessTask(task, actor);
  if (!canUpdate) {
    throw new ApiError(403, "You are not allowed to update this task");
  }

  const next = {};
  if (payload.status !== undefined) {
    next.status = normalizeOption(payload.status, TASK_STATUSES, task.status);
  }

  if (isManager(actor?.role)) {
    if (payload.title !== undefined) {
      const title = String(payload.title || "").trim();
      if (!title) throw new ApiError(400, "Task title is required");
      next.title = title;
    }
    if (payload.description !== undefined) {
      next.description = String(payload.description || "").trim() || null;
    }
    if (payload.priority !== undefined) {
      next.priority = normalizeOption(
        payload.priority,
        TASK_PRIORITIES,
        task.priority,
      );
    }
    if (payload.dueDate !== undefined) {
      next.dueDate = payload.dueDate || null;
    }
  }

  await Task.update(next, { where: { Id: id } });
  return getTaskById(id);
};

const deleteTask = async (id, actor) => {
  if (!isManager(actor?.role)) {
    throw new ApiError(403, "Only admin or super admin can delete tasks");
  }

  const task = await Task.findOne({ where: { Id: id } });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }
  if (!canAccessTask(task, actor)) {
    throw new ApiError(403, "You are not allowed to delete this task");
  }

  await Task.destroy({ where: { Id: id } });
  return { deleted: true };
};

module.exports = {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getAssignableUsers,
};

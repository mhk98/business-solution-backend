const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const PettyCashService = require("./pettyCash.service");
const { pettyCashFilterAbleFields } = require("./pettyCash.constants");
const { Op } = require("sequelize");
const User = db.user;
const Notification = db.notification;
const PettyCash = db.pettyCash;
const PettyCashRequisition = db.pettyCashRequisition;

const isRequisitionMode = (value) =>
  String(value || "").trim() === "requisition";

const canApprovePettyCash = (role) => role === "superAdmin" || role === "admin";

const removeUndefined = (payload) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

const notifyPettyCashUsers = async ({ userId, roles, message, url }) => {
  if (!roles?.length || !message || !url) return;

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: roles },
    },
  });

  if (!users.length) return;

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url,
      }),
    ),
  );
};

const insertIntoDB = catchAsync(async (req, res) => {
  const {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    remarks,
    note,
    date,
    status,
    category,
    userId,
    mode,
    bookId,
  } = req.body;
  // const file = req.file.path.replace(/\\/g, "/");
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const shouldCreateRequisition = isRequisitionMode(mode || req.query?.mode);

  // Requisition creates should always wait for approval, regardless of role/date.
  // Normal petty cash: keep existing behavior.
  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  const inputStatus = String(status || "").trim();
  const isApproved = inputStatus === "Approved";
  const isPending = inputStatus === "Pending";

  const finalStatus = shouldCreateRequisition
    ? "Pending"
    : isApproved
      ? "Approved"
      : isPending
        ? "Pending"
        : inputDateStr !== todayStr
          ? "Pending"
          : note
            ? "Pending"
            : "Active";

  const data = {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    remarks,
    file,
    status: finalStatus || "---",
    note: finalStatus === "Approved" ? null : note || null,
    date: date,
    category,
    bookId: bookId || null,
    requestedByUserId: req.user?.Id || userId || null,
  };

  const result = await PettyCashService.insertIntoDB(data, {
    mode: shouldCreateRequisition ? "requisition" : undefined,
  });

  if (shouldCreateRequisition) {
    await notifyPettyCashUsers({
      userId,
      roles: ["superAdmin", "admin"],
      message: note || "Petty cash requisition request",
      url: `/${process.env.APP_BASE_URL}/petty-cash-requisition`,
    });
  } else if (finalStatus === "Approved") {
    await notifyPettyCashUsers({
      userId,
      roles: ["accountant"],
      message: "Petty cash requisition request approved",
      url: `/${process.env.APP_BASE_URL}/petty-cash`,
    });
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, pettyCashFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await PettyCashService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PettyCashService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    note,
    date,
    status,
    category,
    remarks,
    userId,
    mode,
  } = req.body;
  // const file = req.file.path.replace(/\\/g, "/");
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const shouldUpdateRequisition = isRequisitionMode(mode || req.query?.mode);
  const Model = shouldUpdateRequisition ? PettyCashRequisition : PettyCash;
  const existing = await Model.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) {
    throw new ApiError(404, "Petty cash record not found");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();

  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
  const dateTriggersPending =
    Boolean(inputDateStr) && inputDateStr !== todayStr;

  const isPrivileged = canApprovePettyCash(req.user?.role);

  let finalStatus =
    String(req.body?.status || "").trim() ||
    String(status || "").trim() ||
    String(existing.status || "").trim() ||
    "Active";

  if (!shouldUpdateRequisition) {
    // Keep existing behavior for pettyCash table updates
    if (isPrivileged && finalStatus) {
      // keep
    } else if (["Pending", "Pending Delete"].includes(finalStatus)) {
      finalStatus = "Active";
    }
  } else if (!isPrivileged) {
    // For requisition updates by non-privileged users: always Pending.
    // (Middleware also enforces this, but keep it consistent even if route changes.)
    finalStatus = "Pending";
    // Keep original trigger behavior for notifications.
    if (!dateTriggersPending && !noteTriggersPending) {
      // no-op
    }
  }

  const data = removeUndefined({
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    note:
      note !== undefined
        ? finalStatus === "Approved"
          ? null
          : newNote || null
        : undefined,
    status: finalStatus,
    date: date ? String(date).slice(0, 10) : undefined,
    remarks,
    category,
    file,
  });

  const result =
    shouldUpdateRequisition && isPrivileged && finalStatus === "Approved"
      ? await PettyCashService.approveRequisition(id, req.user, data)
      : await PettyCashService.updateOneFromDB(id, data, {
          mode: shouldUpdateRequisition ? "requisition" : undefined,
        });

  if (finalStatus === "Pending") {
    await notifyPettyCashUsers({
      userId,
      roles: ["superAdmin", "admin"],
      message: newNote || "Petty cash requisition request",
      url: `/${process.env.APP_BASE_URL}/petty-cash-requisition`,
    });
  } else if (finalStatus === "Approved") {
    await notifyPettyCashUsers({
      userId,
      roles: ["accountant"],
      message: "Petty cash requisition request approved",
      url: `/${process.env.APP_BASE_URL}/petty-cash`,
    });
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash PettyCash update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PettyCashService.deleteIdFromDB(req.params.id, {
    mode: req.query?.mode,
  });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash delete successfully!!",
    data: result,
  });
});

const approveRequisition = catchAsync(async (req, res) => {
  const result = await PettyCashService.approveRequisition(
    req.params.id,
    req.user,
  );

  if (!result?.deleted) {
    await notifyPettyCashUsers({
      userId: req.user?.Id,
      roles: ["accountant"],
      message: "Petty cash requisition request approved",
      url: `/${process.env.APP_BASE_URL}/petty-cash`,
    });
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result?.deleted
      ? "Petty cash requisition deleted successfully"
      : "Petty cash requisition approved successfully",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PettyCashService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data fetch!!",
    data: result,
  });
});

const PettyCashController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  approveRequisition,
};

module.exports = PettyCashController;

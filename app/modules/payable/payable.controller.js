const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const PayableService = require("./payable.service");
const { PayableFilterAbleFields } = require("./payable.constants");
const db = require("../../../models");
const { Op } = require("sequelize");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const User = db.user;
const Payable = db.payable;
const Notification = db.notification;

const insertIntoDB = catchAsync(async (req, res) => {
  const { name, amount, remarks, note, status, date } = req.body;

  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  // Status is set by applyApprovalWorkflow middleware.
  const finalStatus = String(status || "").trim() || "Active";

  const data = {
    name,
    amount,
    remarks,
    file,
    status: finalStatus || "---",
    note: finalStatus === "Approved" ? null : note || null,
    date: date,
  };

  const actorUserId = req.user?.Id || null;
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: actorUserId },
      role: { [Op.in]: ["superAdmin", "admin", "accountant"] },
    },
  });

  if (users.length) {
    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note,
      date,
      approvedMessage: "Payable request approved",
      fallbackMessage: "Please approved my request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/payable`,
        }),
      ),
    );
  }
  const result = await PayableService.insertIntoDB(data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payable data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, PayableFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await PayableService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payable data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PayableService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payable data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name, amount, remarks, note, status, date } = req.body;

  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await Payable.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const newNote = String(note || "").trim();

  const inputStatus = String(status || "").trim();
  const finalStatus = inputStatus || existing.status || "Pending";
  const inputDateStr = String(date || "").slice(0, 10);

  const data = {
    name,
    amount,
    remarks,
    note: finalStatus === "Approved" ? null : newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    file,
  };

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: req.user?.Id || null },
      role: { [Op.in]: ["superAdmin", "admin", "accountant"] },
    },
  });

  if (users.length) {
    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
      approvedMessage: "Payable request approved",
      fallbackMessage: "Please approved my request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/payable`,
        }),
      ),
    );
  }
  const result = await PayableService.updateOneFromDB(id, data);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payable Payable update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PayableService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payable delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PayableService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payable data fetch!!",
    data: result,
  });
});

const PayableController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = PayableController;

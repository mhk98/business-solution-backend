const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const { Op } = require("sequelize");
const FundTransferService = require("./fundTransfer.service");
const { FundTransferFilterAbleFields } = require("./fundTransfer.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");

const User = db.user;
const Notification = db.notification;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || ["undefined", "null"].includes(text.toLowerCase())) return null;
  return text;
};

const sanitizeBankAccount = (paymentMode, bankAccount, label) => {
  if (paymentMode !== "Bank") return null;

  const hasValue =
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== "";
  if (!hasValue) {
    throw new ApiError(400, `${label} bank account is required`);
  }

  const numberValue = Number(bankAccount);
  if (Number.isNaN(numberValue)) {
    throw new ApiError(400, `${label} bank account must be a valid number`);
  }

  return numberValue;
};

const notifyPrivilegedUsers = async ({ req, status, note, date, bookId }) => {
  const actor = req.user || {};
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: actor?.Id || null },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (!users.length) return;

  const message = resolveApprovalNotificationMessage({
    status,
    note,
    date,
    approvedMessage: "Fund transfer request approved",
    fallbackMessage: "Please approve my fund transfer request",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/fund-transfer${bookId ? `?bookId=${bookId}` : ""}`,
      }),
    ),
  );
};

const insertIntoDB = catchAsync(async (req, res) => {
  const {
    bookId,
    date,
    fromPaymentMode,
    fromBankAccount,
    fromBankName,
    toPaymentMode,
    toBankAccount,
    toBankName,
    amount,
    note,
    remarks,
    status,
  } = req.body;

  if (!bookId) throw new ApiError(400, "Book is required");
  if (!fromPaymentMode) throw new ApiError(400, "From payment mode is required");
  if (!toPaymentMode) throw new ApiError(400, "To payment mode is required");

  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : 0;
  if (!amountNumber || Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const finalFromBankAccount = sanitizeBankAccount(
    fromPaymentMode,
    fromBankAccount,
    "From",
  );
  const finalToBankAccount = sanitizeBankAccount(
    toPaymentMode,
    toBankAccount,
    "To",
  );

  const normalizedNote = normalizeOptionalText(note);
  const finalStatus = String(status || "").trim() || "Active";

  const data = {
    bookId,
    date,
    fromPaymentMode,
    fromBankAccount: finalFromBankAccount,
    fromBankName,
    toPaymentMode,
    toBankAccount: finalToBankAccount,
    toBankName,
    amount: amountNumber,
    note: normalizedNote,
    remarks,
    status: finalStatus,
  };

  const result = await FundTransferService.insertIntoDB(data);

  await notifyPrivilegedUsers({
    req,
    status: finalStatus,
    note: normalizedNote,
    date,
    bookId,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Fund transfer created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, FundTransferFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await FundTransferService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Fund transfer data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await FundTransferService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Fund transfer data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    bookId,
    date,
    fromPaymentMode,
    fromBankAccount,
    fromBankName,
    toPaymentMode,
    toBankAccount,
    toBankName,
    amount,
    note,
    remarks,
    status,
  } = req.body;

  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : undefined;
  if (
    amountNumber !== undefined &&
    (Number.isNaN(amountNumber) || amountNumber <= 0)
  ) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const finalFromBankAccount =
    fromPaymentMode !== undefined
      ? sanitizeBankAccount(fromPaymentMode, fromBankAccount, "From")
      : undefined;
  const finalToBankAccount =
    toPaymentMode !== undefined
      ? sanitizeBankAccount(toPaymentMode, toBankAccount, "To")
      : undefined;

  const normalizedNote = note !== undefined ? normalizeOptionalText(note) : undefined;

  const data = {
    bookId,
    date,
    fromPaymentMode,
    fromBankAccount: finalFromBankAccount,
    fromBankName,
    toPaymentMode,
    toBankAccount: finalToBankAccount,
    toBankName,
    amount: amountNumber,
    note: normalizedNote,
    remarks,
    status,
  };

  const result = await FundTransferService.updateOneFromDB(id, data);

  await notifyPrivilegedUsers({
    req,
    status: status || "Active",
    note: normalizedNote,
    date,
    bookId,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Fund transfer updated successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await FundTransferService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Fund transfer delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await FundTransferService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Fund transfer data fetch!!",
    data: result,
  });
});

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

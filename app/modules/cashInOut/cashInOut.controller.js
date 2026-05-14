const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const CashInOutService = require("./cashInOut.service");
const { CashInOutFilterAbleFields } = require("./cashInOut.constants");
const { Op } = require("sequelize");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const User = db.user;
const CashInOut = db.cashInOut;
const Notification = db.notification;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (!text || ["undefined", "null"].includes(text.toLowerCase())) {
    return null;
  }

  return text;
};

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

const isPrivilegedRole = (role) => {
  const r = normalizeRole(role);
  return r === "admin" || r === "superadmin";
};

const getTodayYmd = () => {
  // App users operate in BD time; using UTC via toISOString() can flip dates around midnight.
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
};

// const insertIntoDB = catchAsync(async (req, res) => {
//   const {
//     name,
//     paymentMode,
//     paymentStatus,
//     bankName,
//     bankAccount,
//     amount,
//     remarks,
//     category,
//     date,
//     note,
//     status,
//     bookId,
//     supplierId,
//     userId,
//   } = req.body;

//   // ✅ file optional safe
//   const file = req.file?.path ? req.file.path.replace(/\\/g, "/") : null;

//   const isBank = paymentMode === "Bank";

//   // ✅ bankAccount sanitize
//   const bankAccountNumber =
//     isBank &&
//     bankAccount !== undefined &&
//     bankAccount !== null &&
//     String(bankAccount).trim() !== ""
//       ? Number(bankAccount)
//       : null;

//   if (isBank && bankAccountNumber !== null && Number.isNaN(bankAccountNumber)) {
//     throw new ApiError(400, "Bank Account must be a valid number");
//   }

//   // ✅ amount sanitize
//   const amountNumber =
//     amount !== undefined && amount !== null && String(amount).trim() !== ""
//       ? Number(amount)
//       : 0;

//   if (!amountNumber || Number.isNaN(amountNumber) || amountNumber <= 0) {
//     throw new ApiError(400, "Amount must be greater than 0");
//   }

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

//   // ✅ Approved হলে পুরোনো date-ও allow + save
//   const isApproved = String(status || "").trim() === "Approved";

//   // ✅ current date না হলে auto Pending
//   const finalStatus = isApproved
//     ? "Approved"
//     : inputDateStr !== todayStr
//       ? "Pending"
//       : note
//         ? "Pending"
//         : "Active";

//   const data = {
//     name: name || null,
//     paymentMode,
//     paymentStatus,
//     bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে empty
//     bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL (not "")
//     amount: amountNumber,
//     remarks: remarks || "",
//     status: finalStatus || "---",
//     note: finalStatus === "Approved" ? null : note || null,
//     date: date,
//     file, // null allowed
//     category,
//     bookId,
//     supplierId,
//   };

//   const users = await User.findAll({
//     attributes: ["Id", "role"],
//     where: {
//       Id: { [Op.ne]: userId },
//       role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
//     },
//   });

//   if (users.length) {
//     const message =
//       status === "Approved"
//         ? "Cash in/out request approved"
//         : note || "Please approved my request";

//     await Promise.all(
//       users.map((u) =>
//         Notification.create({
//           userId: u.Id,
//           message,
//           url: `/${process.env.APP_BASE_URL}/purchase-requisition`,
//         }),
//       ),
//     );
//   }

//   const result = await CashInOutService.insertIntoDB(data);

//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "CashInOut data created!!",
//     data: result,
//   });
// });

const insertIntoDB = catchAsync(async (req, res) => {
  const {
    name,
    paymentMode,
    paymentStatus,
    bankName,
    bankAccount,
    amount,
    remarks,
    category,
    date,
    note,
    status,
    lender,
    bookId,
    supplierId,
  } = req.body;

  const file = req.file?.path ? req.file.path.replace(/\\/g, "/") : null;

  const isBank = paymentMode === "Bank";
  const isCashOut = paymentStatus === "CashOut";

  // ✅ bankAccount sanitize
  const bankAccountNumber =
    isBank &&
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== ""
      ? Number(bankAccount)
      : null;

  if (isBank && bankAccountNumber !== null && Number.isNaN(bankAccountNumber)) {
    throw new ApiError(400, "Bank Account must be a valid number");
  }

  // ✅ amount sanitize
  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : 0;

  if (!amountNumber || Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  // ✅ supplierId sanitize only for CashOut
  const finalSupplierId =
    isCashOut &&
    supplierId !== undefined &&
    supplierId !== null &&
    String(supplierId).trim() !== ""
      ? Number(supplierId)
      : null;

  if (isCashOut && finalSupplierId !== null && Number.isNaN(finalSupplierId)) {
    throw new ApiError(400, "SupplierId must be a valid number");
  }

  const normalizedNote = normalizeOptionalText(note);
  const finalStatus = String(status || "").trim() || "Active";

  const data = {
    name: name || null,
    paymentMode,
    paymentStatus,
    bankName: isBank ? bankName || "" : "",
    bankAccount: isBank ? bankAccountNumber : null,
    amount: amountNumber,
    remarks: remarks || "",
    status: finalStatus || "---",
    note: normalizedNote,
    date,
    lender,
    file,
    category,
    bookId,
    supplierId: finalSupplierId, // ✅ only CashOut হলে value যাবে, নাহলে null
  };

  const actor = req.user || {};
  const actorUserId = actor?.Id || null;

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: actorUserId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: normalizedNote,
      date: date,
      approvedMessage: "Cash in/out request approved",
      fallbackMessage: "Please approved my request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/purchase-requisition`,
        }),
      ),
    );
  }

  const result = await CashInOutService.insertIntoDB(data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data created!!",
    data: result,
  });
});
const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, CashInOutFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await CashInOutService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getLoanSummaries = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["searchTerm", "startDate", "endDate"]);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await CashInOutService.getLoanSummaries(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Loan data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getLoanHistory = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["searchTerm", "startDate", "endDate"]);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await CashInOutService.getLoanHistory(
    req.params.lender,
    filters,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Loan history fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await CashInOutService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data fetched!!",
    data: result,
  });
});

// const updateOneFromDB = catchAsync(async (req, res) => {
//   const { id } = req.params;
//   const {
//     name,
//     paymentMode,
//     paymentStatus,
//     bankName,
//     bankAccount,
//     amount,
//     remarks,
//     bookId,
//   } = req.body;
//   const file = req.file.path.replace(/\\/g, "/");

//   const data = {
//     name,
//     paymentMode,
//     bankName,
//     bankAccount,
//     paymentStatus,
//     amount,
//     remarks,
//     file,
//     bookId,
//   };

//   const result = await CashInOutService.updateOneFromDB(id, data);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "CashInOut CashInOut update successfully!!",
//     data: result,
//   });
// });

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;

  const {
    name,
    paymentMode,
    paymentStatus,
    bankName,
    bankAccount,
    amount,
    remarks,
    date,
    note,
    category,
    status,
    bookId,
    lender,
    supplierId,
  } = req.body;

  // ✅ file optional safe (new file না দিলে আগেরটা থাকবে - service এ handle করা ভাল)
  const file = req.file?.path ? req.file.path.replace(/\\/g, "/") : undefined;

  const isBank = paymentMode === "Bank";

  // ✅ bankAccount sanitize
  const bankAccountNumber =
    isBank &&
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== ""
      ? Number(bankAccount)
      : null;

  if (isBank && bankAccountNumber !== null && Number.isNaN(bankAccountNumber)) {
    throw new ApiError(400, "Bank Account must be a valid number");
  }

  // ✅ amount sanitize (update এ amount optional হতে পারে, তবে দিলে validate)
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

  // ✅ আগে পুরোনো ডাটা আনো
  const existing = await CashInOut.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const newNote = normalizeOptionalText(note);
  const actor = req.user || {};
  const finalStatus =
    String(status || "").trim() ||
    String(existing.status || "").trim() ||
    "Active";

  const data = {
    name: name ?? undefined,
    paymentMode: paymentMode ?? undefined,
    paymentStatus: paymentStatus ?? undefined,
    bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে blank
    bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL
    remarks: remarks ?? undefined,
    note: finalStatus === "Approved" ? null : newNote,
    status: finalStatus,
    date: (date && String(date).slice(0, 10)) || undefined,
    category,
    lender,
    bookId: bookId || undefined,
    supplierId: supplierId || undefined,
    ...(amountNumber !== undefined ? { amount: amountNumber } : {}),

    // ✅ file only include if uploaded
    ...(file !== undefined ? { file } : {}),
  };

  // Used by service notification logic (do not trust client-sent userId).
  data.userId = actor?.Id || null;

  const result = await CashInOutService.updateOneFromDB(id, data);

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: actor?.Id || null },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: date,
      approvedMessage: "Cash book request approved",
      fallbackMessage: "Please approved my request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/book/${bookId}`,
        }),
      ),
    );
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut updated successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await CashInOutService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await CashInOutService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data fetch!!",
    data: result,
  });
});

const CashInOutController = {
  getAllFromDB,
  getLoanSummaries,
  getLoanHistory,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = CashInOutController;

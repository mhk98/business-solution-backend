const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const db = require("../../../models");
const MarketingExpenseService = require("./marketingExpense.service");
const {
  MarketingExpenseFilterAbleFields,
  MarketingExpenseOverviewFilterAbleFileds,
} = require("./marketingExpense.constants");
const { Op } = require("sequelize");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const marketingExpenseOverview = require("./marketingExpenseOverview");
const User = db.user;
const MarketingExpense = db.marketingExpense;
const Notification = db.notification;

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
    bookId,
    userId,
  } = req.body;

  // ✅ file optional safe
  const file = req.file?.path ? req.file.path.replace(/\\/g, "/") : null;

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

  // ✅ amount sanitize
  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : 0;

  if (!amountNumber || Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const finalStatus = String(status || "").trim() || "Active";

  const data = {
    name: name || null,
    paymentMode,
    paymentStatus,
    bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে empty
    bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL (not "")
    amount: amountNumber,
    remarks: remarks || "",
    status: finalStatus || "---",
    note: finalStatus === "Approved" ? null : note || null,
    date: date,
    file, // null allowed
    category,
    bookId,
  };

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note,
      date,
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

  const result = await MarketingExpenseService.insertIntoDB(data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "MarketingExpense data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, MarketingExpenseFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await MarketingExpenseService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "MarketingExpense data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await MarketingExpenseService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "MarketingExpense data fetched!!",
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

//   const result = await MarketingExpenseService.updateOneFromDB(id, data);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "MarketingExpense MarketingExpense update successfully!!",
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
    userId,
    actorRole,
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await MarketingExpense.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();

  // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

  // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
  const dateTriggersPending =
    Boolean(inputDateStr) && inputDateStr !== todayStr;

  const inputStatus = String(status || "").trim();

  let finalStatus = existing.status || "Pending";

  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  if (isPrivileged) {
    // ✅ superAdmin/admin: যা পাঠাবে সেটাই
    finalStatus = inputStatus || finalStatus;
  } else {
    // ✅ others: today date না হলে বা new note হলে Pending override
    if (dateTriggersPending || noteTriggersPending) {
      finalStatus = "Pending";
    } else {
      // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
      finalStatus = inputStatus || finalStatus;
    }
  }

  const data = {
    name: name ?? undefined,
    paymentMode: paymentMode ?? undefined,
    paymentStatus: paymentStatus ?? undefined,
    bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে blank
    bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL
    remarks: remarks ?? undefined,
    note: finalStatus === "Approved" ? null : newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    category,
    bookId: bookId,
    ...(amountNumber !== undefined ? { amount: amountNumber } : {}),

    // ✅ file only include if uploaded
    ...(file !== undefined ? { file } : {}),
  };

  const result = await MarketingExpenseService.updateOneFromDB(id, data);

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
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
    message: "MarketingExpense updated successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await MarketingExpenseService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "MarketingExpense delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await MarketingExpenseService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "MarketingExpense data fetch!!",
    data: result,
  });
});

const getOverviewSummaryFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, MarketingExpenseOverviewFilterAbleFileds);

  const result =
    await marketingExpenseOverview.getOverviewSummaryFromDB(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Overview summary fetched!!",
    data: result,
  });
});
const MarketingExpenseController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
  getOverviewSummaryFromDB,
};

module.exports = MarketingExpenseController;

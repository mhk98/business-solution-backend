const { ACCOUNT_TYPES } = require("../bankAccount/bankAccount.constants");
const WALLET_MODES = ACCOUNT_TYPES.filter((type) => type !== "Bank");
const { getUploadedFilePath } = require("../../config/uploads");
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
const Loan = db.loan;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (!text || ["undefined", "null"].includes(text.toLowerCase())) {
    return null;
  }

  return text;
};

// Director party on a Book entry: "Investment" or "Profit" (Profit is a
// Cash Out only choice). Anything else means "not chosen".
const normalizeDirectorEntryType = (value) => {
  const type = String(value || "").trim().toLowerCase();
  if (type === "investment" || type === "invest") return "Investment";
  if (type === "profit") return "Profit";
  return undefined;
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

const resolveLoanFields = async ({ category, partyType, loanId, lender }) => {
  const isLoan = String(category || "").trim().toLowerCase() === "loan";
  const isLenderParty =
    String(partyType || "").trim().toLowerCase() === "lender";
  if (!isLoan && !isLenderParty) {
    return { loanId: null, lender: null };
  }

  const hasLoanId =
    loanId !== undefined && loanId !== null && String(loanId).trim() !== "";
  if (!hasLoanId) {
    return { loanId: null, lender: normalizeOptionalText(lender) };
  }

  const finalLoanId = Number(loanId);
  if (Number.isNaN(finalLoanId)) {
    throw new ApiError(400, "LoanId must be a valid number");
  }

  const loan = await Loan.findByPk(finalLoanId);
  if (!loan) {
    throw new ApiError(404, "Loan not found");
  }

  return { loanId: finalLoanId, lender: loan.name };
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

// A supplier entry with no cash but a discount is stored as "Discount" (not
// Cash In/Out); once it carries cash it is a normal Cash Out again.
const supplierEntryStatus = (paymentStatus, amount, discount) => {
  if (paymentStatus !== "CashOut" && paymentStatus !== "Discount") {
    return paymentStatus;
  }
  return Number(amount || 0) === 0 && Number(discount || 0) > 0
    ? "Discount"
    : "CashOut";
};

// Supplier discount (non-cash). undefined = not sent; otherwise a number >= 0.
const parseDiscountAmount = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new ApiError(400, "Discount must be 0 or more");
  }
  return n;
};

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
    categoryId,
    date,
    note,
    status,
    lender,
    loanId,
    bookId,
    supplierId,
    dollarSupplierId,
    manufacturerId,
    packagingManufacturerId,
    ownerId,
    directorId,
    directorEntryType,
    partyType,
    voucherPrefix,
    refNo,
    fromParty,
    receiverName,
    discountAmount,
  } = req.body;

  const file = req.file?.path ? getUploadedFilePath(req.file) : null;

  const isBank = paymentMode === "Bank";
  const isWalletMode = WALLET_MODES.includes(paymentMode);
  const isAccountMode = isBank || isWalletMode;
  // "Discount" = supplier discount-only Book entry: neither Cash In nor Cash
  // Out, but it keeps the supplier link like a Cash Out.
  const isCashOut = paymentStatus === "CashOut" || paymentStatus === "Discount";
  const isOwnerParty =
    String(partyType || "").trim().toLowerCase() === "owner";
  const isDirectorParty =
    String(partyType || "").trim().toLowerCase() === "director";
  const isManufacturerParty =
    String(partyType || "").trim().toLowerCase() === "manufacturer";
  const isPackagingManufacturerParty =
    String(partyType || "").trim().toLowerCase() === "packaging manufacturer";

  // ✅ bankAccount sanitize
  const hasBankAccountValue =
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== "";
  // Bank keeps its historical numeric form; Bkash/Nagad/Rocket wallet
  // numbers stay text so the leading 0 (017…) survives.
  const bankAccountNumber = !hasBankAccountValue
    ? null
    : isBank
      ? Number(bankAccount)
      : isWalletMode
        ? String(bankAccount).trim()
        : null;

  if (isBank && bankAccountNumber !== null && Number.isNaN(bankAccountNumber)) {
    throw new ApiError(400, "Bank Account must be a valid number");
  }

  // ✅ amount sanitize
  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : 0;

  const discountNumber = parseDiscountAmount(discountAmount) ?? 0;
  const isSupplierCashOut =
    isCashOut &&
    supplierId !== undefined &&
    supplierId !== null &&
    String(supplierId).trim() !== "";
  if (discountNumber > 0 && !isSupplierCashOut) {
    throw new ApiError(400, "Discount is only allowed on a supplier Cash Out");
  }

  // A supplier discount-only entry carries no cash (amount 0).
  if (
    Number.isNaN(amountNumber) ||
    amountNumber < 0 ||
    (amountNumber === 0 && discountNumber <= 0)
  ) {
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

  // ✅ dollarSupplierId sanitize only for CashOut
  const finalDollarSupplierId =
    isCashOut &&
    dollarSupplierId !== undefined &&
    dollarSupplierId !== null &&
    String(dollarSupplierId).trim() !== ""
      ? Number(dollarSupplierId)
      : null;

  if (
    isCashOut &&
    finalDollarSupplierId !== null &&
    Number.isNaN(finalDollarSupplierId)
  ) {
    throw new ApiError(400, "DollarSupplierId must be a valid number");
  }

  // ✅ manufacturerId sanitize only for CashOut
  const finalManufacturerId =
    isCashOut &&
    manufacturerId !== undefined &&
    manufacturerId !== null &&
    String(manufacturerId).trim() !== ""
      ? Number(manufacturerId)
      : null;

  if (
    isCashOut &&
    finalManufacturerId !== null &&
    Number.isNaN(finalManufacturerId)
  ) {
    throw new ApiError(400, "ManufacturerId must be a valid number");
  }

  if (isManufacturerParty && !finalManufacturerId) {
    throw new ApiError(400, "Manufacturer is required");
  }

  // ✅ packagingManufacturerId sanitize only for CashOut
  const finalPackagingManufacturerId =
    isCashOut &&
    packagingManufacturerId !== undefined &&
    packagingManufacturerId !== null &&
    String(packagingManufacturerId).trim() !== ""
      ? Number(packagingManufacturerId)
      : null;

  if (
    isCashOut &&
    finalPackagingManufacturerId !== null &&
    Number.isNaN(finalPackagingManufacturerId)
  ) {
    throw new ApiError(400, "PackagingManufacturerId must be a valid number");
  }

  if (isPackagingManufacturerParty && !finalPackagingManufacturerId) {
    throw new ApiError(400, "Packaging manufacturer is required");
  }

  const finalOwnerId =
    ownerId !== undefined && ownerId !== null && String(ownerId).trim() !== ""
      ? Number(ownerId)
      : null;

  if (finalOwnerId !== null && Number.isNaN(finalOwnerId)) {
    throw new ApiError(400, "OwnerId must be a valid number");
  }

  if (isOwnerParty && !finalOwnerId) {
    throw new ApiError(400, "Owner is required");
  }

  const finalDirectorId =
    directorId !== undefined &&
    directorId !== null &&
    String(directorId).trim() !== ""
      ? Number(directorId)
      : null;

  if (finalDirectorId !== null && Number.isNaN(finalDirectorId)) {
    throw new ApiError(400, "DirectorId must be a valid number");
  }

  if (isDirectorParty && !finalDirectorId) {
    throw new ApiError(400, "Director is required");
  }

  const finalDirectorEntryType = normalizeDirectorEntryType(directorEntryType);
  if (
    isDirectorParty &&
    finalDirectorEntryType === "Profit" &&
    (paymentStatus) !== "CashOut"
  ) {
    throw new ApiError(400, "Director Profit is only for Cash Out");
  }

  const normalizedNote = normalizeOptionalText(note);
  const finalStatus = String(status || "").trim() || "Active";
  const loanFields = await resolveLoanFields({
    category,
    partyType,
    loanId,
    lender,
  });

  const data = {
    name: name || null,
    paymentMode,
    bankName: isAccountMode ? bankName || "" : "",
    bankAccount: isAccountMode ? bankAccountNumber : null,
    amount: amountNumber,
    discountAmount: discountNumber,
    paymentStatus: supplierEntryStatus(paymentStatus, amountNumber, discountNumber),
    remarks: remarks || "",
    status: finalStatus || "---",
    note: normalizedNote,
    date,
    refNo: normalizeOptionalText(refNo),
    fromParty: isCashOut ? null : normalizeOptionalText(fromParty),
    receiverName: isCashOut ? normalizeOptionalText(receiverName) : null,
    lender: loanFields.lender,
    loanId: loanFields.loanId,
    file,
    category,
    categoryId,
    bookId,
    supplierId: finalSupplierId, // ✅ only CashOut হলে value যাবে, নাহলে null
    dollarSupplierId: finalDollarSupplierId, // ✅ only CashOut হলে value যাবে, নাহলে null
    manufacturerId: finalManufacturerId, // ✅ only CashOut হলে value যাবে, নাহলে null
    packagingManufacturerId: finalPackagingManufacturerId, // ✅ only CashOut হলে value যাবে, নাহলে null
    ownerId: finalOwnerId,
    directorId: finalDirectorId,
    directorEntryType: finalDirectorEntryType,
    voucherPrefix: normalizeOptionalText(voucherPrefix) || "KM-",
  };

  const actor = req.user || {};
  const actorUserId = actor?.Id || null;

  const result = await CashInOutService.insertIntoDB(data);

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
    categoryId,
    status,
    bookId,
    lender,
    loanId,
    supplierId,
    dollarSupplierId,
    manufacturerId,
    packagingManufacturerId,
    ownerId,
    directorId,
    directorEntryType,
    partyType,
    refNo,
    fromParty,
    receiverName,
    discountAmount,
  } = req.body;

  // ✅ file optional safe (new file না দিলে আগেরটা থাকবে - service এ handle করা ভাল)
  const file = req.file?.path ? getUploadedFilePath(req.file) : undefined;

  const isBank = paymentMode === "Bank";
  const isWalletMode = WALLET_MODES.includes(paymentMode);
  const isAccountMode = isBank || isWalletMode;

  // ✅ bankAccount sanitize
  const hasBankAccountValue =
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== "";
  // Bank keeps its historical numeric form; Bkash/Nagad/Rocket wallet
  // numbers stay text so the leading 0 (017…) survives.
  const bankAccountNumber = !hasBankAccountValue
    ? null
    : isBank
      ? Number(bankAccount)
      : isWalletMode
        ? String(bankAccount).trim()
        : null;

  if (isBank && bankAccountNumber !== null && Number.isNaN(bankAccountNumber)) {
    throw new ApiError(400, "Bank Account must be a valid number");
  }

  // ✅ amount sanitize (update এ amount optional হতে পারে, তবে দিলে validate)
  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : undefined;

  const discountNumber = parseDiscountAmount(discountAmount);
  const hasSupplier =
    supplierId !== undefined &&
    supplierId !== null &&
    String(supplierId).trim() !== "";
  // Discount only lives on supplier Cash Out entries; clearing the supplier
  // clears the discount too.
  const finalDiscount =
    paymentStatus !== undefined &&
    paymentStatus !== "CashOut" &&
    paymentStatus !== "Discount"
      ? 0
      : supplierId !== undefined && !hasSupplier
        ? 0
        : discountNumber;

  if (
    amountNumber !== undefined &&
    (Number.isNaN(amountNumber) ||
      amountNumber < 0 ||
      (amountNumber === 0 && !(finalDiscount > 0)))
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
  const isOwnerParty =
    String(partyType || "").trim().toLowerCase() === "owner";
  const isDirectorParty =
    String(partyType || "").trim().toLowerCase() === "director";
  const finalOwnerId =
    ownerId !== undefined && ownerId !== null && String(ownerId).trim() !== ""
      ? Number(ownerId)
      : null;

  if (finalOwnerId !== null && Number.isNaN(finalOwnerId)) {
    throw new ApiError(400, "OwnerId must be a valid number");
  }

  if (isOwnerParty && !finalOwnerId) {
    throw new ApiError(400, "Owner is required");
  }

  const finalDirectorId =
    directorId !== undefined &&
    directorId !== null &&
    String(directorId).trim() !== ""
      ? Number(directorId)
      : null;

  if (finalDirectorId !== null && Number.isNaN(finalDirectorId)) {
    throw new ApiError(400, "DirectorId must be a valid number");
  }

  if (isDirectorParty && !finalDirectorId) {
    throw new ApiError(400, "Director is required");
  }

  const finalDirectorEntryType = normalizeDirectorEntryType(directorEntryType);
  if (
    isDirectorParty &&
    finalDirectorEntryType === "Profit" &&
    (paymentStatus || existing.paymentStatus) !== "CashOut"
  ) {
    throw new ApiError(400, "Director Profit is only for Cash Out");
  }

  const loanFields = await resolveLoanFields({
    category,
    partyType,
    loanId,
    lender,
  });
  const shouldTrackLoan =
    String(category || "").trim().toLowerCase() === "loan" ||
    String(partyType || "").trim().toLowerCase() === "lender";

  const data = {
    name: name ?? undefined,
    paymentMode: paymentMode ?? undefined,
    paymentStatus:
      paymentStatus !== undefined && amountNumber !== undefined
        ? supplierEntryStatus(paymentStatus, amountNumber, finalDiscount)
        : paymentStatus ?? undefined,
    bankName: isAccountMode ? bankName || "" : "", // ✅ Bank/wallet না হলে blank
    bankAccount: isAccountMode ? bankAccountNumber : null, // ✅ Bank/wallet না হলে NULL
    remarks: remarks ?? undefined,
    note: finalStatus === "Approved" ? null : newNote,
    status: finalStatus,
    refNo: refNo !== undefined ? normalizeOptionalText(refNo) : undefined,
    fromParty:
      fromParty !== undefined ? normalizeOptionalText(fromParty) : undefined,
    receiverName:
      receiverName !== undefined
        ? normalizeOptionalText(receiverName)
        : undefined,
    date: (date && String(date).slice(0, 10)) || undefined,
    category,
    categoryId,
    lender: shouldTrackLoan ? loanFields.lender : null,
    loanId: shouldTrackLoan ? loanFields.loanId : null,
    bookId: bookId || undefined,
    supplierId: supplierId !== undefined ? supplierId || null : undefined,
    dollarSupplierId:
      dollarSupplierId !== undefined ? dollarSupplierId || null : undefined,
    manufacturerId:
      manufacturerId !== undefined ? manufacturerId || null : undefined,
    packagingManufacturerId:
      packagingManufacturerId !== undefined
        ? packagingManufacturerId || null
        : undefined,
    ownerId: ownerId !== undefined ? finalOwnerId : undefined,
    directorId: directorId !== undefined ? finalDirectorId : undefined,
    directorEntryType: finalDirectorEntryType,
    ...(amountNumber !== undefined ? { amount: amountNumber } : {}),
    ...(finalDiscount !== undefined ? { discountAmount: finalDiscount } : {}),

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

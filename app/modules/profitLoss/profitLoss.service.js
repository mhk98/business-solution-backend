const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ProfitLossSearchableFields } = require("./profitLoss.constants");
const profitLossInvoiceTemplate = require("../../utils/emailTemplates/profitLossInvoice");
const sendEmail = require("../../middlewares/sendEmail");
const ProfitLoss = db.profitLoss;
const Notification = db.notification;
const User = db.user;

const modelByMode = {
  auto: db.autoProfitLoss,
  user: db.userProfitLoss,
  product: db.profitLoss,
};

const resolveMode = (mode) => (["auto", "user"].includes(mode) ? mode : "product");

const getModelByMode = (mode) => modelByMode[resolveMode(mode)];

const insertIntoDB = async (payload) => {
  const mode = resolveMode(payload?.mode);
  const Model = getModelByMode(mode);
  const result = await Model.create({ ...payload, mode });
  return result;
};

const sendInvoiceEmail = async (payload) => {
  const {
    clientEmail,
    invoiceNumber,
    companyName,
    reportTitle,
    reportDate,
    salesType,
    selectedProducts = [],
    employeeReports = [],
    calculationSummary = {},
    savedHistory = [],
  } = payload;

  const htmlContent = profitLossInvoiceTemplate({
    companyName: companyName || process.env.MAIL_BRAND_NAME,
    reportTitle: reportTitle || "Profit & Loss Invoice",
    reportDate: reportDate ? new Date(reportDate).toLocaleDateString() : "",
    invoiceNumber,
    salesType: salesType || "",
    selectedProducts,
    employeeReports,
    calculationSummary,
    savedHistory,
    supportEmail: process.env.MAIL_SUPPORT_EMAIL,
  });

  const result = await sendEmail({
    to: clientEmail,
    subject: `Your Profit & Loss Invoice - ${invoiceNumber || ""}`,
    htmlContent,
  });

  if (!result) {
    const message = sendEmail.lastError?.message
      ? `Invoice email could not be sent: ${sendEmail.lastError.message}`
      : "Invoice email could not be sent";
    throw new ApiError(400, message);
  }

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, mode, ...otherFilters } = filters;
  const Model = getModelByMode(mode);

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  // if (searchTerm && searchTerm.trim()) {
  //   andConditions.push({
  //     [Op.or]: ProfitLossSearchableFields.map((field) => ({
  //       [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
  //     })),
  //   });
  // }

  if (searchTerm) {
    andConditions.push({
      salesType: { [Op.like]: `${searchTerm}%` },
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range filter (saved date, with createdAt fallback for old rows)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      [Op.or]: [
        { date: { [Op.between]: [startDate, endDate] } },
        {
          [Op.and]: [
            { date: { [Op.is]: null } },
            { createdAt: { [Op.between]: [start, end] } },
          ],
        },
      ],
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Model.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true, // Ensure this is added to include soft deleted records
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const total = await Model.count({ where: whereConditions });

  return {
    meta: { page, limit, total },
    data: result,
  };
};

const getDataById = async (id, mode) => {
  const models = mode
    ? [getModelByMode(mode)]
    : [db.profitLoss, db.autoProfitLoss, db.userProfitLoss];

  for (const Model of models) {
    const result = await Model.findOne({
    where: {
      Id: id,
    },
  });
    if (result) return result;
  }

  return null;
};

// const removeIdFromDB = async (id) => {
//   const result = await ProfitLoss.findOne({
//     where: {
//       Id: id,
//     },
//   });

//   if (!result) {
//     throw new ApiError(404, "Asset purchase data not found");
//   }

//   // Soft delete by updating `deletedAt`
//   result.deletedAt = new Date(); // Set current timestamp
//   await result.save(); // Save the updated product with the deleted timestamp

//   return result;
// };

const deleteIdFromDB = async (id, mode) => {
  const Model = getModelByMode(mode);
  const result = await Model.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

// const updateOneFromDB = async (id, payload) => {
//   const { name, quantity, price, note, status, userId } = payload;

//   console.log("data", payload);

//   const q = quantity === "" || quantity == null ? undefined : Number(quantity);
//   const p = price === "" || price == null ? undefined : Number(price);

//   const finalStatus = status || "Pending";
//   const finalNote = finalStatus === "Approved" ? "---" : note;

//   const data = {
//     name: name === "" ? undefined : name,
//     quantity: q,
//     price: p,
//     note: finalNote,
//     status: finalStatus,
//     total: Number.isFinite(p) && Number.isFinite(q) ? p * q : undefined,
//   };

//   const [updatedCount] = await ProfitLoss.update(data, {
//     where: { Id: id },
//   });

//   // ✅ update না হলে এখানেই থামো
//   if (updatedCount <= 0) return updatedCount;

//   // ✅ শুধু admin/superAdmin/inventory রোলের ইউজার
//   const users = await User.findAll({
//     attributes: ["Id", "role"],
//     where: {
//       Id: { [Op.ne]: userId }, // sender বাদ
//       role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
//     },
//     transaction: t,
//   });

//   console.log("users", users.length);
//   if (!users.length) return updatedCount;

//   const message =
//     finalStatus === "Approved"
//       ? "Assets purchase request approved"
//       : finalNote || "Assets purchase updated";

//   await Promise.all(
//     users.map((u) =>
//       Notification.create(
//         {
//           userId: u.Id,
//           message,
//           url: `/${process.env.APP_BASE_URL}/assets-purchase`,
//         },
//         {
//           transaction: t,
//         },
//       ),
//     ),
//   );

//   return updatedCount;
// };

const updateOneFromDB = async (id, payload, mode) => {
  const nextMode = resolveMode(mode || payload?.mode);
  const Model = getModelByMode(nextMode);
  const [updatedCount] = await Model.update({ ...payload, mode: nextMode }, {
    where: { Id: id },
  });

  // const users = await User.findAll({
  //   attributes: ["Id", "role"],
  //   where: {
  //     Id: { [Op.ne]: userId },
  //     role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
  //   },
  // });

  // if (!users.length) return updatedCount;

  // const message =
  //   finalStatus === "Approved"
  //     ? "Assets purchase request approved"
  //     : newNote || "Assets purchase updated";

  // await Promise.all(
  //   users.map((u) =>
  //     Notification.create({
  //       userId: u.Id,
  //       message,
  //       url: `/${process.env.APP_BASE_URL}/assets-purchase`,
  //     }),
  //   ),
  // );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const [productRows, autoRows, userRows] = await Promise.all(
    [db.profitLoss, db.autoProfitLoss, db.userProfitLoss].map((Model) =>
      Model.findAll({
        paranoid: true,
        order: [["createdAt", "DESC"]],
      }),
    ),
  );

  const result = [...productRows, ...autoRows, ...userRows].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  return result;
};

const ProfitLossService = {
  getAllFromDB,
  insertIntoDB,
  sendInvoiceEmail,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ProfitLossService;

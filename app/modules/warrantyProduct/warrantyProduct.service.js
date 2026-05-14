const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  WarrantyProductSearchableFields,
} = require("./warrantyProduct.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");

const WarrantyProduct = db.warrantyProduct;
const Product = db.product;
const Notification = db.notification;
const User = db.user;
const Sequelize = db.Sequelize;

const insertIntoDB = async (data) => {
  const { quantity, date, note, status, userId, warrantyValue, warrantyUnit } =
    data;

  const productData = await Product.findOne({
    where: {
      Id: receivedId,
    },
  });

  if (!productData) {
    throw new ApiError(404, "Product not found");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : null;

  const payload = {
    name: productData.name,
    quantity,
    purchase_price: productData.purchase_price * quantity,
    sale_price: productData.sale_price * quantity,
    supplier: productData.supplier,
    productId: receivedId,
    status: finalStatus || "---",
    note: finalStatus === "Approved" ? null : note || null,
    date: date,
    warrantyValue,
    warrantyUnit,
  };

  const result = await WarrantyProduct.create(payload);

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
      date: inputDateStr,
      approvedMessage: "Received product request approved",
      fallbackMessage: "Please approved my request",
    });

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/${process.env.APP_BASE_URL}/confirm-order`,
        }),
      ),
    );
  }
  return result;
};

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE on searchable fields)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: WarrantyProductSearchableFields.map((field) => ({
//         [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
//       })),
//     });
//   }

//   // ✅ Exact filters (e.g. name)
//   if (Object.keys(otherFilters).length) {
//     andConditions.push(
//       ...Object.entries(otherFilters).map(([key, value]) => ({
//         [key]: { [Op.eq]: value },
//       })),
//     );
//   }

//   // ✅ Date range filter (createdAt)
//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       date: { [Op.between]: [start, end] },
//     });
//   }

//   // ✅ Exclude soft deleted records
//   andConditions.push({
//     deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
//   });

//   const whereConditions = andConditions.length
//     ? { [Op.and]: andConditions }
//     : {};

//   const result = await WarrantyProduct.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     paranoid: true,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   // const total = await WarrantyProduct.count({ where: whereConditions });

//   // ✅ total count + total quantity (same filters)
//   const [count, totalQuantity] = await Promise.all([
//     WarrantyProduct.count({ where: whereConditions }),
//     WarrantyProduct.sum("quantity", { where: whereConditions }),
//   ]);

//   return {
//     meta: { count, totalQuantity: totalQuantity || 0, page, limit },
//     data: result,
//   };
// };

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (MariaDB compatible, case-insensitive)
  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();

    andConditions.push({
      [Op.or]: WarrantyProductSearchableFields.map((field) =>
        Sequelize.where(Sequelize.fn("LOWER", Sequelize.col(field)), {
          [Op.like]: `%${q}%`,
        }),
      ),
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

  // ✅ Date range filter (তোমার কোডে field name date আছে)
  // যদি আসলে createdAt দিয়ে filter করতে চাও, তাহলে "date" -> "createdAt" করে দিও।
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records (paranoid true থাকলে এটা লাগেই না, তবু রেখে দিলাম)
  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await WarrantyProduct.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const [count, totalQuantity] = await Promise.all([
    WarrantyProduct.count({ where: whereConditions }),
    WarrantyProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await WarrantyProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await WarrantyProduct.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, data) => {
  const { quantity, receivedId, note, status, userId } = data;

  const productData = await Product.findOne({
    where: {
      Id: receivedId,
    },
  });

  if (!productData) {
    throw new ApiError(404, "Product not found");
  }

  const payload = {
    name: productData.name,
    quantity,
    purchase_price: productData.purchase_price * quantity,
    sale_price: productData.sale_price * quantity,
    supplier: productData.supplier,
    productId: receivedId,
    note: status === "Approved" ? null : note,
    status: status ? status : "Pending",
  };

  const [updatedCount] = await WarrantyProduct.update(payload, {
    where: {
      Id: id,
    },
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message = resolveApprovalNotificationMessage({
    status: finalStatus,
    note: newNote,
    date: inputDateStr,
    approvedMessage: "Confirm order request approved",
    fallbackMessage: "Confirm order updated",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/confirm-order`,
      }),
    ),
  );
  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await WarrantyProduct.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const WarrantyProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = WarrantyProductService;

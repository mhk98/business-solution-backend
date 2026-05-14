const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { pettyCashSearchableFields } = require("./pettyCash.constants");
const PettyCash = db.pettyCash;
const PettyCashRequisition = db.pettyCashRequisition;
const CashInOut = db.cashInOut;
const Book = db.book;

const isRequisitionMode = (mode) => String(mode || "").trim() === "requisition";

const getModelByMode = (mode) =>
  isRequisitionMode(mode) ? PettyCashRequisition : PettyCash;

const pickModelAttributes = (Model, payload) =>
  Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      return Model.rawAttributes?.[key] && value !== undefined;
    }),
  );

const stripWorkflowNote = (value) =>
  String(value || "")
    .replace(/\[Approval pending for update\]/g, "")
    .replace(/\[Update request approved\]/g, "")
    .replace(/\[Petty cash requisition approved\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildApprovedRequisitionNote = (value) => {
  const note = stripWorkflowNote(value);
  return note
    ? `${note} [Petty cash requisition approved]`
    : "[Petty cash requisition approved]";
};

const insertIntoDB = async (data, options = {}) => {
  const Model = getModelByMode(options.mode);
  const rawPayload = isRequisitionMode(options.mode)
    ? {
        ...data,
        paymentStatus: "CashIn",
      }
    : data;
  const payload = pickModelAttributes(Model, rawPayload);
  const result = await Model.create(payload);
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
  //     [Op.or]: pettyCashSearchableFields.map((field) => ({
  //       [field]: { [Op.like]: `%${searchTerm.trim()}%` },
  //     })),
  //   });
  // }

  // if (searchTerm) {
  //   andConditions.push({
  //     [Op.or]: pettyCashSearchableFields.map((field) => ({
  //       [field]: { [Op.like]: `%${searchTerm}%` }, // Postgres হলে Op.iLike
  //     })),
  //   });
  // }

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();

    andConditions.push({
      [Op.or]: [
        { status: { [Op.like]: `%${term}%` } },
        { remarks: { [Op.like]: `%${term}%` } },
        { paymentMode: { [Op.like]: `%${term}%` } },
        { paymentStatus: { [Op.like]: `%${term}%` } },
        { category: { [Op.like]: `%${term}%` } },

        // ✅ numeric field search
        db.Sequelize.where(
          db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"),
          {
            [Op.like]: `%${term}%`,
          },
        ),
      ],
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => {
        if (
          key === "status" &&
          typeof value === "string" &&
          value.includes(",")
        ) {
          return {
            [key]: {
              [Op.in]: value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            },
          };
        }

        return {
          [key]: { [Op.eq]: value },
        };
      }),
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
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
    include: [{ model: Book, as: "book", attributes: ["Id", "name"] }],
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["date", "DESC"]],
  });

  // const total = await PettyCash.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)

  const [count, totalCashIn, totalCashOut] = await Promise.all([
    Model.count({ where: whereConditions }),
    Model.sum("amount", {
      where: { ...whereConditions, paymentStatus: "CashIn" },
    }),
    Model.sum("amount", {
      where: { ...whereConditions, paymentStatus: "CashOut" },
    }),
  ]);

  const cashIn = Number(totalCashIn || 0);
  const cashOut = Number(totalCashOut || 0);
  const netBalance = cashIn - cashOut;

  return {
    meta: {
      count,
      totalCashIn: cashIn,
      totalCashOut: cashOut,
      netBalance,
      page,
      limit,
    },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await PettyCash.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id, options = {}) => {
  const Model = getModelByMode(options.mode);
  const result = await Model.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload, options = {}) => {
  const Model = getModelByMode(options.mode);
  const [updatedCount] = await Model.update(payload, {
    where: {
      Id: id,
    },
  });

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PettyCash.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const approveRequisition = async (id, actor = {}, updates = {}) => {
  return db.sequelize.transaction(async (transaction) => {
    const requisition = await PettyCashRequisition.findOne({
      where: { Id: id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!requisition) {
      throw new ApiError(404, "Petty cash requisition not found");
    }

    if (requisition.status === "Pending Delete") {
      await PettyCashRequisition.destroy({
        where: { Id: id },
        transaction,
      });
      return { deleted: true, workflowAction: "deleted" };
    }

    if (requisition.status === "Approved" && requisition.pettyCashId) {
      return requisition;
    }

    const allowedUpdateFields = [
      "paymentMode",
      "bankName",
      "paymentStatus",
      "amount",
      "note",
      "remarks",
      "file",
      "category",
      "date",
      "bookId",
    ];
    const requisitionUpdates = allowedUpdateFields.reduce((acc, field) => {
      if (updates[field] !== undefined) {
        acc[field] = updates[field];
      }
      return acc;
    }, {});

    if (Object.keys(requisitionUpdates).length) {
      await requisition.update(requisitionUpdates, { transaction });
    }

    const approvedNote = buildApprovedRequisitionNote(requisition.note);

    // Get bookId from requisition or use default book
    let bookId = requisition.bookId || updates.bookId;
    if (!bookId) {
      const defaultBook = await Book.findOne({
        where: { status: "Active" },
        order: [["Id", "ASC"]],
        transaction,
      });
      bookId = defaultBook?.Id || null;
    }

    const pettyCash = await PettyCash.create(
      {
        paymentMode: requisition.paymentMode,
        bankName: requisition.bankName,
        paymentStatus: "CashIn",
        amount: requisition.amount,
        note: approvedNote,
        status: "Active",
        remarks: requisition.remarks,
        file: requisition.file,
        category: requisition.category,
        date: requisition.date,
        bookId: bookId,
      },
      { transaction },
    );

    // Create CashOut entry in book when approved
    if (bookId) {
      await CashInOut.create(
        {
          bookId: bookId,
          paymentStatus: "CashOut",
          amount: requisition.amount,
          status: "Active",
          date: requisition.date || new Date(),
          note: approvedNote || "Petty cash requisition approved",
        },
        { transaction },
      );
    }

    await requisition.update(
      {
        status: "Approved",
        note: approvedNote,
        pettyCashId: pettyCash.Id,
        approvedByUserId: actor.Id || null,
        approvedAt: new Date(),
      },
      { transaction },
    );

    return requisition;
  });
};

const PettyCashService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  approveRequisition,
};

module.exports = PettyCashService;

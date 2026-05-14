const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { EmployeeSearchableFields } = require("./employee.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const Employee = db.employee;
const Notification = db.notification;
const User = db.user;
const LedgerHistory = db.ledgerHistory;
const CashInOut = db.cashInOut;
const EmployeeList = db.employeeList;
const Department = db.department;

const employeeInclude = [
  {
    model: Department,
    as: "department",
    attributes: ["Id", "name", "code", "status"],
    required: false,
  },
];

const getSafeAmount = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const resolveEmployeeListId = async ({
  employeeListId,
  employee_id,
  transaction,
}) => {
  const directId = normalizeOptionalId(employeeListId);
  if (directId) return directId;

  if (!employee_id) return null;

  const employee = await EmployeeList.findOne({
    where: { employee_id },
    attributes: ["Id"],
    transaction,
  });

  return employee?.Id || null;
};

const resolveLedgerEmployeeId = ({ employee_id, employeeListId }) =>
  normalizeOptionalId(employeeListId) || normalizeOptionalId(employee_id);

const createAdvanceSettlementEntries = async (
  { employeeId, amount, bookId, date },
  transaction,
) => {
  const advanceAmount = getSafeAmount(amount);
  const normalizedEmployeeId = normalizeOptionalId(employeeId);
  const normalizedBookId = normalizeOptionalId(bookId);

  if (!normalizedEmployeeId || advanceAmount <= 0) return null;

  const cashInOut = await CashInOut.create(
    {
      employeeId: normalizedEmployeeId,
      paymentStatus: "CashIn",
      category: "Advance",
      amount: advanceAmount,
      bookId: normalizedBookId,
      status: "Active",
      date: date || new Date(),
      note: "Payroll advance adjustment",
    },
    { transaction },
  );

  const ledgerHistory = await LedgerHistory.create(
    {
      employeeId: normalizedEmployeeId,
      paidAmount: advanceAmount,
      unpaidAmount: 0,
      status: "Paid",
      bookId: normalizedBookId,
      cashInOutId: cashInOut.Id,
      date: date || new Date(),
      note: "Payroll advance adjustment",
    },
    { transaction },
  );

  return { cashInOut, ledgerHistory };
};

const insertIntoDB = async (payload) => {
  const {
    name,
    employee_id,
    bookId,
    basic_salary,
    incentive,
    holiday_payment,
    total_salary,
    advance,
    late,
    early_leave,
    absent,
    friday_absent,
    unapproval_absent,
    net_salary,
    note,
    remarks,
    status,
    userId,
    employeeListId,
    departmentId,
    date,
  } = payload;

  console.log("employeeData", payload);
  const finalStatus = String(status || "").trim() || "Pending";

  const data = {
    name,
    employee_id,
    basic_salary,
    incentive,
    holiday_payment,
    total_salary,
    advance,
    late,
    early_leave,
    absent,
    friday_absent,
    unapproval_absent,
    net_salary,
    note,
    remarks,
    status: finalStatus,
    userId,
    employeeListId,
    departmentId: normalizeOptionalId(departmentId),
    bookId: normalizeOptionalId(bookId),
    date,
  };

  return db.sequelize.transaction(async (t) => {
    const result = await Employee.create(data, { transaction: t });

    if (!result) {
      throw new ApiError(500, "Failed to create employee record");
    }

    const resolvedEmployeeListId = await resolveEmployeeListId({
      employeeListId,
      employee_id,
      transaction: t,
    });
    const payrollEmployeeId = resolveLedgerEmployeeId({
      employee_id,
      employeeListId: resolvedEmployeeListId,
    });

    const hasAdvanceAdjustment = getSafeAmount(result.advance) > 0;

    if (payrollEmployeeId && hasAdvanceAdjustment) {
      await createAdvanceSettlementEntries(
        {
          employeeId: payrollEmployeeId,
          amount: result.advance,
          bookId,
          date: result.date,
        },
        t,
      );
    }

    // Always create CashOut for total_salary if it exists, regardless of advance
    if (payrollEmployeeId && getSafeAmount(result.total_salary) > 0) {
      await CashInOut.create(
        {
          employeeId: payrollEmployeeId,
          paymentStatus: "CashOut",
          category: "salary",
          amount: result.total_salary,
          bookId: normalizeOptionalId(bookId),
          status: "Active",
          date: result.date || new Date(),
          note: "Payroll salary payment",
        },
        { transaction: t },
      );
    }
    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: EmployeeSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
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

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      createdAt: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, options.sortOrder.toUpperCase()]]
      : [["createdAt", "DESC"]];

  const [result, count, totalSalary] = await Promise.all([
    Employee.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      include: employeeInclude,
      paranoid: true,
      order,
    }),
    Employee.count({ where: whereConditions }),
    Employee.sum("net_salary", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalSalary: Number(totalSalary || 0), page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Employee.findOne({
    where: {
      Id: id,
    },
    include: employeeInclude,
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Employee.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const {
    name,
    employee_id,
    basic_salary,
    incentive,
    holiday_payment,
    total_salary,
    advance,
    late,
    early_leave,
    absent,
    friday_absent,
    unapproval_absent,
    net_salary,
    note,
    remarks,
    status,
    userId,
    employeeListId,
    departmentId,
    bookId,
    date,
    actorRole,
  } = payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await Employee.findOne({
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
    name,
    employee_id,
    basic_salary,
    incentive,
    holiday_payment,
    total_salary,
    advance,
    late,
    early_leave,
    absent,
    friday_absent,
    unapproval_absent,
    net_salary,
    note: finalStatus === "Completed" ? null : newNote || null,
    date: inputDateStr || undefined,
    remarks,
    status: finalStatus,
    userId,
    employeeListId,
    departmentId: normalizeOptionalId(departmentId),
    bookId: normalizeOptionalId(bookId),
  };

  const existingEmployee = await Employee.findOne({
    where: { Id: id },
    attributes: [
      "advance",
      "total_salary",
      "employee_id",
      "employeeListId",
      "bookId",
      "date",
    ],
  });

  const [updatedCount] = await Employee.update(data, {
    where: {
      Id: id,
    },
  });

  // Handle CashInOut entries for advance and salary payments
  if (updatedCount > 0) {
    const updatedEmployee = await Employee.findOne({
      where: { Id: id },
      attributes: [
        "advance",
        "total_salary",
        "employee_id",
        "employeeListId",
        "bookId",
        "date",
      ],
    });

    if (updatedEmployee) {
      const resolvedEmployeeListId = await resolveEmployeeListId({
        employeeListId: updatedEmployee.employeeListId,
        employee_id: updatedEmployee.employee_id,
      });
      const payrollEmployeeId = resolveLedgerEmployeeId({
        employee_id: updatedEmployee.employee_id,
        employeeListId: resolvedEmployeeListId,
      });

      const oldAdvance = getSafeAmount(existingEmployee?.advance);
      const oldSalary = getSafeAmount(existingEmployee?.total_salary);
      const newAdvance = getSafeAmount(updatedEmployee.advance);
      const newSalary = getSafeAmount(updatedEmployee.total_salary);
      const salaryDateFilter =
        existingEmployee?.date || updatedEmployee.date || null;
      const advanceDateFilter =
        existingEmployee?.date || updatedEmployee.date || null;

      const normalizedBookId = normalizeOptionalId(updatedEmployee.bookId);

      if (payrollEmployeeId) {
        const existingAdvanceEntry = await CashInOut.findOne({
          where: {
            employeeId: payrollEmployeeId,
            paymentStatus: "CashIn",
            category: "Advance",
            ...(advanceDateFilter ? { date: advanceDateFilter } : {}),
          },
          order: [["Id", "DESC"]],
        });

        if (newAdvance > 0) {
          if (existingAdvanceEntry) {
            if (
              existingAdvanceEntry.amount !== newAdvance ||
              existingAdvanceEntry.bookId !== normalizedBookId ||
              String(existingAdvanceEntry.date) !==
                String(updatedEmployee.date || existingAdvanceEntry.date)
            ) {
              await existingAdvanceEntry.update({
                amount: newAdvance,
                bookId: normalizedBookId,
                date: updatedEmployee.date || existingAdvanceEntry.date,
                note: "Payroll advance adjustment",
                status: "Active",
              });

              await LedgerHistory.update(
                { paidAmount: newAdvance },
                { where: { cashInOutId: existingAdvanceEntry.Id } },
              );
            }
          } else {
            await createAdvanceSettlementEntries({
              employeeId: payrollEmployeeId,
              amount: updatedEmployee.advance,
              bookId: updatedEmployee.bookId,
              date: updatedEmployee.date,
            });
          }
        } else if (oldAdvance > 0 && existingAdvanceEntry) {
          await existingAdvanceEntry.destroy();
          await LedgerHistory.destroy({
            where: { cashInOutId: existingAdvanceEntry.Id },
          });
        }

        const existingSalaryEntry = await CashInOut.findOne({
          where: {
            employeeId: payrollEmployeeId,
            paymentStatus: "CashOut",
            category: "salary",
            ...(salaryDateFilter ? { date: salaryDateFilter } : {}),
          },
          order: [["Id", "DESC"]],
        });

        if (newSalary > 0) {
          if (existingSalaryEntry) {
            if (
              existingSalaryEntry.amount !== newSalary ||
              existingSalaryEntry.bookId !== normalizedBookId ||
              String(existingSalaryEntry.date) !==
                String(updatedEmployee.date || existingSalaryEntry.date)
            ) {
              await existingSalaryEntry.update({
                amount: newSalary,
                bookId: normalizedBookId,
                date: updatedEmployee.date || existingSalaryEntry.date,
                note: "Payroll salary payment",
                status: "Active",
              });
            }
          } else {
            await CashInOut.create({
              employeeId: payrollEmployeeId,
              paymentStatus: "CashOut",
              category: "salary",
              amount: updatedEmployee.total_salary,
              bookId: normalizedBookId,
              status: "Active",
              date: updatedEmployee.date || new Date(),
              note: "Payroll salary payment",
            });
          }
        } else if (oldSalary > 0 && existingSalaryEntry) {
          await existingSalaryEntry.destroy();
        }
      }
    }
  }

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "accountant"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message = resolveApprovalNotificationMessage({
    status: finalStatus,
    note: newNote,
    date: inputDateStr,
    approvedMessage: "Employee salary calculation request approved",
    fallbackMessage: "Employee salary calculation updated",
  });

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/${process.env.APP_BASE_URL}/employee`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Employee.findAll({
    include: employeeInclude,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const EmployeeService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = EmployeeService;

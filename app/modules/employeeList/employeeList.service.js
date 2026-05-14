const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { EmployeeListSearchableFields } = require("./employeeList.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const EmployeeList = db.employeeList;
const User = db.user;
const Department = db.department;
const Designation = db.designation;
const Shift = db.shift;
const LedgerHistory = db.ledgerHistory;

const normalizeOptionalForeignKey = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const employeeIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["Id", "FirstName", "LastName", "Email", "Phone", "role"],
    required: false,
  },
  {
    model: Department,
    as: "department",
    attributes: ["Id", "name", "code", "status"],
    required: false,
  },
  {
    model: Designation,
    as: "designation",
    attributes: ["Id", "name", "code", "status"],
    required: false,
  },
  {
    model: Shift,
    as: "shift",
    attributes: ["Id", "name", "code", "startTime", "endTime", "status"],
    required: false,
  },
  {
    model: EmployeeList,
    as: "reportingManager",
    attributes: ["Id", "name", "employeeCode", "employee_id"],
    required: false,
  },
];

const getSafeAmount = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getEmployeeLedgerIds = (employee = {}) => {
  const ids = [employee.Id, employee.employee_id]
    .map((value) => {
      if (value === undefined || value === null || value === "") return null;

      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : null;
    })
    .filter((value) => value !== null);

  return [...new Set(ids)];
};

const getEmployeeAdvanceSummary = async (employee, transaction) => {
  const employeeIds = getEmployeeLedgerIds(employee);

  if (!employeeIds.length) {
    return {
      advance: 0,
      advanceBalance: 0,
      ledgerPaidAmount: 0,
      ledgerUnpaidAmount: 0,
    };
  }

  const where = {
    employeeId:
      employeeIds.length === 1 ? employeeIds[0] : { [Op.in]: employeeIds },
  };

  const [paidAmount, unpaidAmount] = await Promise.all([
    LedgerHistory.sum("paidAmount", { where, transaction }),
    LedgerHistory.sum("unpaidAmount", { where, transaction }),
  ]);

  const paid = getSafeAmount(paidAmount);
  const unpaid = getSafeAmount(unpaidAmount);
  const advanceBalance = Math.max(unpaid - paid, 0);

  return {
    advance: advanceBalance,
    advanceBalance,
    ledgerPaidAmount: paid,
    ledgerUnpaidAmount: unpaid,
  };
};

const buildAdvanceSummary = ({ paid, unpaid }) => {
  const safePaid = getSafeAmount(paid);
  const safeUnpaid = getSafeAmount(unpaid);
  const advanceBalance = Math.max(safeUnpaid - safePaid, 0);

  return {
    advance: advanceBalance,
    advanceBalance,
    ledgerPaidAmount: safePaid,
    ledgerUnpaidAmount: safeUnpaid,
  };
};

const attachAdvanceSummary = async (employee, transaction) => {
  if (!employee) return employee;

  const plainEmployee =
    typeof employee.get === "function" ? employee.get({ plain: true }) : employee;
  const advanceSummary = await getEmployeeAdvanceSummary(
    plainEmployee,
    transaction,
  );

  return {
    ...plainEmployee,
    ...advanceSummary,
  };
};

const attachAdvanceSummaries = async (employees, transaction) => {
  const plainEmployees = employees.map((employee) =>
    typeof employee.get === "function" ? employee.get({ plain: true }) : employee,
  );
  const allEmployeeIds = [
    ...new Set(plainEmployees.flatMap((employee) => getEmployeeLedgerIds(employee))),
  ];

  if (!allEmployeeIds.length) {
    return plainEmployees.map((employee) => ({
      ...employee,
      ...buildAdvanceSummary({ paid: 0, unpaid: 0 }),
    }));
  }

  const ledgerRows = await LedgerHistory.findAll({
    attributes: [
      "employeeId",
      [db.sequelize.fn("SUM", db.sequelize.col("paidAmount")), "paidAmount"],
      [
        db.sequelize.fn("SUM", db.sequelize.col("unpaidAmount")),
        "unpaidAmount",
      ],
    ],
    where: { employeeId: { [Op.in]: allEmployeeIds } },
    group: ["employeeId"],
    raw: true,
    transaction,
  });

  const totalsByEmployeeId = ledgerRows.reduce((acc, row) => {
    acc[String(row.employeeId)] = {
      paid: getSafeAmount(row.paidAmount),
      unpaid: getSafeAmount(row.unpaidAmount),
    };
    return acc;
  }, {});

  return plainEmployees.map((employee) => {
    const totals = getEmployeeLedgerIds(employee).reduce(
      (acc, employeeId) => {
        const rowTotal = totalsByEmployeeId[String(employeeId)];
        if (!rowTotal) return acc;

        acc.paid += rowTotal.paid;
        acc.unpaid += rowTotal.unpaid;
        return acc;
      },
      { paid: 0, unpaid: 0 },
    );

    return {
      ...employee,
      ...buildAdvanceSummary(totals),
    };
  });
};

const buildEmployeeData = (payload = {}, currentStatus) => {
  const inputStatus = String(payload.status || "").trim();
  const inputDateStr = String(payload.date || payload.joiningDate || "").slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const note = String(payload.note || "").trim();

  const finalStatus =
    inputStatus ||
    currentStatus ||
    (inputDateStr && inputDateStr !== todayStr ? "Pending" : note ? "Pending" : "Active");

  return {
    name: payload.name,
    employee_id: payload.employee_id,
    employeeCode: payload.employeeCode || null,
    userId: normalizeOptionalForeignKey(payload.userId),
    email: payload.email || null,
    phone: payload.phone || null,
    departmentId: normalizeOptionalForeignKey(payload.departmentId),
    designationId: normalizeOptionalForeignKey(payload.designationId),
    shiftId: normalizeOptionalForeignKey(payload.shiftId),
    reportingManagerId: normalizeOptionalForeignKey(payload.reportingManagerId),
    employmentType: payload.employmentType || null,
    joiningDate: payload.joiningDate || inputDateStr || null,
    salary: payload.salary,
    status: finalStatus,
    pendingAction: payload.pendingAction || null,
    approvalNote:
      payload.approvalNote !== undefined
        ? String(payload.approvalNote || "").trim() || null
        : null,
    requestedByUserId: payload.requestedByUserId || null,
    date: inputDateStr || null,
    note: finalStatus === "Approved" ? null : note || null,
  };
};

const ensureLinkedUserExists = async (userId) => {
  if (!userId) return;

  const user = await User.findOne({
    where: { Id: userId },
    attributes: ["Id"],
  });

  if (!user) {
    throw new ApiError(400, "Linked user was not found");
  }
};

const insertIntoDB = async (payload, user) => {
  const data = buildEmployeeData(applyCreateWorkflow(payload, user));

  await ensureLinkedUserExists(data.userId);

  return db.sequelize.transaction(async (t) => {
    const result = await EmployeeList.create(data, { transaction: t });

    const createdEmployee = await EmployeeList.findOne({
      where: { Id: result.Id },
      include: employeeIncludes,
      transaction: t,
    });

    return attachAdvanceSummary(createdEmployee, t);
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    const normalizedSearchTerm = searchTerm.trim();
    andConditions.push({
      [Op.or]: EmployeeListSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${normalizedSearchTerm}%` },
      })),
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    andConditions.push({
      [key]: { [Op.eq]: value },
    });
  });

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const result = await EmployeeList.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: employeeIncludes,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await EmployeeList.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: await attachAdvanceSummaries(result),
  };
};

const getDataById = async (id) => {
  const result = await EmployeeList.findOne({
    where: { Id: id },
    include: employeeIncludes,
  });

  return attachAdvanceSummary(result);
};

const getProfileByUserId = async (userId) => {
  const result = await EmployeeList.findOne({
    where: { userId },
    include: employeeIncludes,
  });

  if (!result) {
    throw new ApiError(404, "Employee profile was not found for this user");
  }

  return attachAdvanceSummary(result);
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await EmployeeList.findOne({
    where: { Id: id },
    attributes: ["Id"],
  });

  if (!existing) {
    throw new ApiError(404, "Employee record not found");
  }

  if (isPrivilegedRole(user.role)) {
    await EmployeeList.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await EmployeeList.update(buildDeleteWorkflowPayload(note, user), {
    where: { Id: id },
  });

  return {
    ...(await getDataById(id)),
    workflowAction: "delete_requested",
  };
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await EmployeeList.findOne({
    where: { Id: id },
    attributes: ["Id", "status"],
  });

  if (!existing) {
    throw new ApiError(404, "Employee record not found");
  }

  const data = buildEmployeeData(
    applyUpdateWorkflow(payload, user),
    existing.status,
  );

  await ensureLinkedUserExists(data.userId);

  await EmployeeList.update(data, {
    where: { Id: id },
  });

  return getDataById(id);
};

const approveOneFromDB = async (id) => {
  const existing = await EmployeeList.findOne({
    where: { Id: id },
    attributes: ["Id", "pendingAction"],
  });

  if (!existing) {
    throw new ApiError(404, "Employee record not found");
  }

  if (existing.pendingAction === "Delete") {
    await EmployeeList.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await EmployeeList.update(
    {
      status: "Active",
      pendingAction: null,
      approvalNote: null,
      requestedByUserId: null,
    },
    { where: { Id: id } },
  );

  return {
    ...(await getDataById(id)),
    workflowAction: "approved",
  };
};

const getAllFromDBWithoutQuery = async () => {
  const result = await EmployeeList.findAll({
    include: employeeIncludes,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return attachAdvanceSummaries(result);
};

const EmployeeListService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  approveOneFromDB,
  getDataById,
  getProfileByUserId,
  getAllFromDBWithoutQuery,
};

module.exports = EmployeeListService;

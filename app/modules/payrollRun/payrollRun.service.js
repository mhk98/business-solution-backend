const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const PayrollRun = db.payrollRun;
const PayrollItem = db.payrollItem;
const EmployeeList = db.employeeList;
const AttendanceSummary = db.attendanceSummary;
const LeaveRequest = db.leaveRequest;
const LeaveType = db.leaveType;

const payrollRunIncludes = [];

const round2 = (value) => Number(Number(value || 0).toFixed(2));
const monthRange = (month) => {
  const [year, monthNum] = String(month).split("-").map(Number);
  if (!year || !monthNum) throw new ApiError(400, "month must be in YYYY-MM format");
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

const listRuns = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...otherFilters } = filters;
  const andConditions = [];
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: [
        { month: { [Op.like]: `%${searchTerm.trim()}%` } },
        { title: { [Op.like]: `%${searchTerm.trim()}%` } },
      ],
    });
  }
  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });
  andConditions.push({ deletedAt: { [Op.is]: null } });
  const where = andConditions.length ? { [Op.and]: andConditions } : {};
  const data = await PayrollRun.findAll({ where, offset: skip, limit, paranoid: true, order: [["createdAt", "DESC"]] });
  const count = await PayrollRun.count({ where });
  return { meta: { count, page, limit }, data };
};

const getRunById = async (id) =>
  PayrollRun.findOne({
    where: { Id: id },
    include: [
      {
        model: PayrollItem,
        as: "items",
        include: [{ model: EmployeeList, as: "employee", attributes: ["Id", "name", "employeeCode", "employee_id"] }],
      },
    ],
  });

const generatePayrollRun = async (payload = {}) => {
  const month = payload.month;
  if (!month) throw new ApiError(400, "month is required");
  const { start, end } = monthRange(month);

  const [employees, summaries, approvedLeaves] = await Promise.all([
    EmployeeList.findAll({
      where: {
        deletedAt: { [Op.is]: null },
        status: { [Op.in]: ["Active", "Approved", "Pending"] },
      },
      paranoid: true,
    }),
    AttendanceSummary.findAll({
      where: {
        attendanceDate: { [Op.between]: [start, end] },
        deletedAt: { [Op.is]: null },
      },
      paranoid: true,
    }),
    LeaveRequest.findAll({
      where: {
        approvalStatus: "Approved",
        startDate: { [Op.lte]: end },
        endDate: { [Op.gte]: start },
        deletedAt: { [Op.is]: null },
      },
      include: [{ model: LeaveType, as: "leaveType", attributes: ["Id", "isPaid"] }],
      paranoid: true,
    }),
  ]);

  const summaryByEmployee = summaries.reduce((acc, row) => {
    if (!acc[row.employeeId]) acc[row.employeeId] = [];
    acc[row.employeeId].push(row);
    return acc;
  }, {});
  const leaveByEmployee = approvedLeaves.reduce((acc, row) => {
    if (!acc[row.employeeId]) acc[row.employeeId] = [];
    acc[row.employeeId].push(row);
    return acc;
  }, {});

  return db.sequelize.transaction(async (t) => {
    const existingRun = await PayrollRun.findOne({ where: { month }, transaction: t });
    if (existingRun) {
      await PayrollItem.destroy({ where: { payrollRunId: existingRun.Id }, force: true, transaction: t });
      await PayrollRun.destroy({ where: { Id: existingRun.Id }, force: true, transaction: t });
    }

    const run = await PayrollRun.create(
      {
        month,
        title: payload.title || `Payroll ${month}`,
        status: payload.status || "Draft",
        generatedAt: new Date(),
        note: payload.status === "Approved" ? null : payload.note || null,
      },
      { transaction: t },
    );

    let grossAmount = 0;
    let deductionAmount = 0;
    let netAmount = 0;

    for (const employee of employees) {
      const baseSalary = Number(employee.salary || 0);
      const dailyRate = baseSalary / 30;
      const minuteRate = dailyRate / (8 * 60);
      const employeeSummaries = summaryByEmployee[employee.Id] || [];
      const employeeLeaves = leaveByEmployee[employee.Id] || [];

      const absentDays = employeeSummaries.filter((item) => item.attendanceStatus === "Absent").length;
      const lateCount = employeeSummaries.filter((item) => Number(item.lateMinutes || 0) > 0).length;
      const overtimeMinutes = employeeSummaries.reduce((sum, item) => sum + Number(item.overtimeMinutes || 0), 0);
      const paidLeaveDays = employeeLeaves
        .filter((item) => item.leaveType?.isPaid)
        .reduce((sum, item) => sum + Number(item.totalDays || 0), 0);
      const unpaidLeaveDays = employeeLeaves
        .filter((item) => !item.leaveType?.isPaid)
        .reduce((sum, item) => sum + Number(item.totalDays || 0), 0);

      const overtimeAmount = round2(overtimeMinutes * minuteRate);
      const absentDeduction = round2(absentDays * dailyRate);
      const unpaidLeaveDeduction = round2(unpaidLeaveDays * dailyRate);
      const lateDeduction = round2(lateCount * (dailyRate * 0.1));
      const employeeGross = round2(baseSalary + overtimeAmount);
      const employeeDeduction = round2(absentDeduction + unpaidLeaveDeduction + lateDeduction);
      const employeeNet = round2(employeeGross - employeeDeduction);

      grossAmount += employeeGross;
      deductionAmount += employeeDeduction;
      netAmount += employeeNet;

      await PayrollItem.create(
        {
          payrollRunId: run.Id,
          employeeId: employee.Id,
          baseSalary,
          paidLeaveDays,
          unpaidLeaveDays,
          absentDays,
          lateCount,
          overtimeMinutes,
          overtimeAmount,
          absentDeduction,
          unpaidLeaveDeduction,
          lateDeduction,
          grossAmount: employeeGross,
          deductionAmount: employeeDeduction,
          netAmount: employeeNet,
          remarks: payload.itemRemarks || null,
        },
        { transaction: t },
      );
    }

    await PayrollRun.update(
      {
        totalEmployees: employees.length,
        grossAmount: round2(grossAmount),
        deductionAmount: round2(deductionAmount),
        netAmount: round2(netAmount),
      },
      { where: { Id: run.Id }, transaction: t },
    );

    return getRunById(run.Id);
  });
};

const updateRun = async (id, payload) => {
  if (payload.status === "Finalized" && !payload.finalizedAt) {
    payload.finalizedAt = new Date();
  }
  await PayrollRun.update(payload, { where: { Id: id } });
  return getRunById(id);
};

module.exports = {
  listRuns,
  getRunById,
  generatePayrollRun,
  updateRun,
};

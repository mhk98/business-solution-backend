module.exports = (sequelize, DataTypes) => {
  const PayrollItem = sequelize.define(
    "PayrollItem",
    {
      Id: { type: DataTypes.INTEGER(10), primaryKey: true, autoIncrement: true, allowNull: false },
      payrollRunId: { type: DataTypes.INTEGER(10), allowNull: false },
      employeeId: { type: DataTypes.INTEGER(10), allowNull: false },
      baseSalary: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      paidLeaveDays: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      unpaidLeaveDays: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      absentDays: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      lateCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      overtimeMinutes: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      overtimeAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      absentDeduction: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      unpaidLeaveDeduction: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      lateDeduction: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      grossAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      deductionAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      netAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      remarks: { type: DataTypes.STRING, allowNull: true },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { timestamps: true, paranoid: true },
  );
  return PayrollItem;
};

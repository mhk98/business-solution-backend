// Which shift an employee works from a date onward. A changed shift gets a
// new row so earlier days keep the shift they were worked under. Days not
// covered by any row fall back to EmployeeList.shiftId, then the policy's
// default shift.
module.exports = (sequelize, DataTypes) => {
  const EmployeeShiftAssignment = sequelize.define(
    "EmployeeShiftAssignment",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      shiftId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      effectiveFrom: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      // Open-ended when null.
      effectiveTo: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      // Overrides the shift's weekly off days for this employee (e.g. a
      // rotating off day). Null = use the shift's.
      weeklyOffDays: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      // This employee's own office time / grace. Null = use the shift's.
      startTime: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      endTime: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      graceInMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      graceOutMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      indexes: [{ fields: ["userId", "effectiveFrom"] }],
    },
  );
  return EmployeeShiftAssignment;
};

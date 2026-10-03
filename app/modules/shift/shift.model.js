module.exports = (sequelize, DataTypes) => {
  const Shift = sequelize.define(
    "Shift",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
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
      weeklyOffDays: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      // Attendance engine rules (app/modules/attendance/attendance.rules.js).
      // Deducted from a stay at least 4h longer than it.
      breakMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // Worked less than this = Half Day (0/null = off).
      fullDayMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // Worked less than this = Absent (0/null = off).
      halfDayMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      overtimeStartAfterMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      minimumOvertimeMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Active",
      },
      pendingAction: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      approvalNote: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      requestedByUserId: {
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
    },
  );

  return Shift;
};

// Company-wide attendance rules — a single row (Id = 1), edited on
// HRM → Attendance Policy. Defaults live in attendance.policy.js.
module.exports = (sequelize, DataTypes) => {
  const AttendancePolicy = sequelize.define(
    "AttendancePolicy",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      // Days before this are never computed (the device went live then).
      trackFromDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      // Used for employees with no shift assignment.
      defaultShiftId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      // Weekly off when an employee has no shift at all.
      defaultWeeklyOffDays: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      // Punches closer together than this count as one (double tap).
      duplicatePunchMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      // A finished working day with only one punch: Present | Half Day | Absent
      singlePunchAs: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "Present",
      },
      // Every N late days = 1 day deducted in the monthly summary (0 = off).
      lateDaysPerAbsent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      earlyLeaveDaysPerAbsent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      overtimeEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Whole worked time on a holiday / weekly off counts as overtime.
      offDayWorkAsOvertime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Working on a holiday / weekly off earns that day's salary on top
      // (added to payable days in the monthly summary).
      holidayWorkPaid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      weeklyOffWorkPaid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Holiday / weekly off between two absent working days becomes absent.
      sandwichRule: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Background job re-computes this many past days every few hours.
      recomputeDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 7,
      },
      updatedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
    },
    {
      timestamps: true,
    },
  );
  return AttendancePolicy;
};

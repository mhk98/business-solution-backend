// The computed result for one employee on one date — written by the engine
// (attendance.engine.js). A locked row (manual override) is never rewritten
// by the engine until it is unlocked.
//
// presentValue / absentValue / leaveValue are day fractions (0, 0.5, 1) so a
// half day or a half-day leave sums correctly in monthly totals.
module.exports = (sequelize, DataTypes) => {
  const AttendanceDay = sequelize.define(
    "AttendanceDay",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      employeeId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      attendanceDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      shiftId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      shiftStart: {
        type: DataTypes.STRING(5),
        allowNull: true,
      },
      shiftEnd: {
        type: DataTypes.STRING(5),
        allowNull: true,
      },
      // Local "YYYY-MM-DD HH:MM:SS" (Bangladesh time).
      inTime: {
        type: DataTypes.STRING(19),
        allowNull: true,
      },
      outTime: {
        type: DataTypes.STRING(19),
        allowNull: true,
      },
      punchCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      workedMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lateMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      earlyLeaveMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      overtimeMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Present | Half Day | Absent | Leave | Half Leave | Holiday |
      // Weekly Off | Pending
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Absent",
      },
      isLate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isEarlyLeave: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isMissingPunch: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      workedOnOffDay: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      presentValue: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        defaultValue: 0,
      },
      absentValue: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        defaultValue: 0,
      },
      leaveValue: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        defaultValue: 0,
      },
      leaveIsPaid: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      holidayId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      leaveRequestId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      leaveTypeId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // auto | manual
      source: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "auto",
      },
      isLocked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lockedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      manualNote: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      computedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [
        { unique: true, fields: ["employeeId", "attendanceDate"] },
        { fields: ["attendanceDate"] },
      ],
    },
  );
  return AttendanceDay;
};

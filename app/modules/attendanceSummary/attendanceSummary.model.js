module.exports = (sequelize, DataTypes) => {
  const AttendanceSummary = sequelize.define(
    "AttendanceSummary",
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
      firstIn: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastOut: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      workedMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      overtimeMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      lateMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      earlyLeaveMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      rawLogCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      attendanceStatus: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: "Absent",
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "machine",
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

  return AttendanceSummary;
};

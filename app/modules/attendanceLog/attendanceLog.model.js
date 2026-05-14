module.exports = (sequelize, DataTypes) => {
  const AttendanceLog = sequelize.define(
    "AttendanceLog",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      attendanceDeviceId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      employeeId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      deviceUserId: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      punchTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      punchType: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: "check",
      },
      verificationMethod: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: "face",
      },
      syncBatchId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      sourcePayload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      processingStatus: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Pending",
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
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

  return AttendanceLog;
};

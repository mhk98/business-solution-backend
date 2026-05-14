module.exports = (sequelize, DataTypes) => {
  const AttendanceEnrollment = sequelize.define(
    "AttendanceEnrollment",
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
      attendanceDeviceId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      deviceUserId: {
        type: DataTypes.STRING(128),
        allowNull: false,
      },
      biometricModes: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      enrollmentStatus: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Enrolled",
      },
      enrolledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastSyncedAt: {
        type: DataTypes.DATE,
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

  return AttendanceEnrollment;
};

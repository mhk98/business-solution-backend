module.exports = (sequelize, DataTypes) => {
  const AttendanceRegularization = sequelize.define(
    "AttendanceRegularization",
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
      requestType: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: "Missing Punch",
      },
      requestedIn: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      requestedOut: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      requestedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      approvedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      approvalStatus: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Pending",
      },
      approvedAt: {
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

  return AttendanceRegularization;
};

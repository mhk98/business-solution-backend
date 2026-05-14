module.exports = (sequelize, DataTypes) => {
  const LeaveRequest = sequelize.define(
    "LeaveRequest",
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
      leaveTypeId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      totalDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      approvalStatus: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Pending",
      },
      requestedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      approvedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
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

  return LeaveRequest;
};

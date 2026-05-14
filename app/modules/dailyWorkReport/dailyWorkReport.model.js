module.exports = (sequelize, DataTypes) => {
  const DailyWorkReport = sequelize.define(
    "DailyWorkReport",
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
      employeeId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      reportDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      todayWork: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },
      tomorrowPlan: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },
      blockers: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
      workStartTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      workEndTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      totalWorkingHours: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Submitted",
      },
      reviewNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      reminderSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ["userId", "reportDate"],
        },
      ],
    },
  );

  return DailyWorkReport;
};

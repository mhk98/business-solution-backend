module.exports = (sequelize, DataTypes) => {
  const DailyWorkReportTask = sequelize.define(
    "DailyWorkReportTask",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      reportId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      taskId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      taskSource: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Self-created",
      },
      taskTitle: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      taskDescription: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
      taskCategory: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      priority: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "Medium",
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "Pending",
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      outputResult: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
      proofLink: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      proofFileUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      blockerProblem: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
      selfRating: {
        type: DataTypes.INTEGER(2),
        allowNull: false,
        defaultValue: 3,
      },
      progressPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      timeSpentMinutes: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      isDueToday: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "DailyWorkReportTasks",
    },
  );

  return DailyWorkReportTask;
};

module.exports = (sequelize, DataTypes) => {
  const PerformanceScore = sequelize.define(
    "PerformanceScore",
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
        unique: true,
      },
      employeeId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      reportDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      taskCompletionScore: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      },
      productivityScore: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      },
      qualityScore: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      },
      consistencyScore: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      },
      initiativeScore: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      },
      finalScore: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      },
      completedTasks: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      pendingTasks: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      failedTasks: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      holdTasks: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      totalTasks: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      totalWorkingHours: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "PerformanceScores",
      indexes: [
        { fields: ["reportDate"] },
        { fields: ["employeeId"] },
        { fields: ["userId"] },
      ],
    },
  );

  return PerformanceScore;
};

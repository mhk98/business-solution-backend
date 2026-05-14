module.exports = (sequelize, DataTypes) => {
  const PerformanceEvaluation = sequelize.define(
    "PerformanceEvaluation",
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
      qualityScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      initiativeScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      managerRemarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Pending",
      },
      reviewedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "PerformanceEvaluations",
    },
  );

  return PerformanceEvaluation;
};

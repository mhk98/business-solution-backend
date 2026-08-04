module.exports = (sequelize, DataTypes) => {
  const PerformanceTrackerChannel = sequelize.define(
    "PerformanceTrackerChannel",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      short_code: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      color: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "#4f46e5",
      },
      created_by: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "performance_tracker_channels",
      timestamps: true,
      paranoid: true,
    },
  );

  return PerformanceTrackerChannel;
};

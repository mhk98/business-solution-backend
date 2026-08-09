module.exports = (sequelize, DataTypes) => {
  const PerformanceTrackerProduct = sequelize.define(
    "PerformanceTrackerProduct",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      channel_id: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING(64),
        allowNull: true,
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
      tableName: "performance_tracker_products",
      timestamps: true,
      paranoid: true,
    },
  );

  return PerformanceTrackerProduct;
};

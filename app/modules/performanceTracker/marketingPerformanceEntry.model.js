module.exports = (sequelize, DataTypes) => {
  const MarketingPerformanceEntry = sequelize.define(
    "MarketingPerformanceEntry",
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
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      spend_usd: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      usd_rate: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      },
      spend_local: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_revenue_local: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_orders: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      note: {
        type: DataTypes.TEXT,
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
      tableName: "marketing_performance_entries",
      timestamps: true,
      paranoid: true,
    },
  );

  return MarketingPerformanceEntry;
};

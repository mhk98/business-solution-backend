module.exports = (sequelize, DataTypes) => {
  const PerformanceTrackerAdsAccount = sequelize.define(
    "PerformanceTrackerAdsAccount",
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
      account_code: {
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
      tableName: "performance_tracker_ads_accounts",
      timestamps: true,
      paranoid: true,
    },
  );

  return PerformanceTrackerAdsAccount;
};

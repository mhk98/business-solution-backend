module.exports = (sequelize, DataTypes) => {
  const ChannelPerformanceTarget = sequelize.define(
    "ChannelPerformanceTarget",
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
        unique: true,
      },
      target_marketing_cost_percent: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 15,
      },
      roas_alert_threshold: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 3,
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
      tableName: "channel_performance_targets",
      timestamps: true,
      paranoid: true,
    },
  );

  return ChannelPerformanceTarget;
};

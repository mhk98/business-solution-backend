module.exports = (sequelize, DataTypes) => {
  const AdsCampaignKPI = sequelize.define(
    "AdsCampaignKPI",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      campaignName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      platform: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      adsAccountId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      adsAccountName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      spend: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      result: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      confirm: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      revenue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Active",
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

  return AdsCampaignKPI;
};

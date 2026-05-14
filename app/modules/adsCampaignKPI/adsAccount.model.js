module.exports = (sequelize, DataTypes) => {
  const AdsAccount = sequelize.define(
    "AdsAccount",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      platform: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      accountName: {
        type: DataTypes.STRING,
        allowNull: false,
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

  return AdsAccount;
};

module.exports = (sequelize, DataTypes) => {
  const AutoProfitLoss = sequelize.define(
    "AutoProfitLoss",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      mode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "auto",
        validate: {
          isIn: [["auto"]],
        },
      },
      salesType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      products: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      purchase: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      revenue: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      return: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      marketingSpends: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      otherExpenses: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      incentiveType: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "flat",
      },
      incentiveValue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      incentiveAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      returnPercentage: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
      },
      cost: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      profitLoss: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      note: {
        type: DataTypes.STRING,
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

  return AutoProfitLoss;
};

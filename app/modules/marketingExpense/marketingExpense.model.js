const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const MarketingExpense = sequelize.define(
    "MarketingExpense",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      paymentMode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankAccount: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // A DM Expense entry can be a USD purchase from a dollar supplier: the
      // local amount above = usdAmount * usdRate, and it also mirrors into
      // DollarSupplierHistory as a due.
      dollarSupplierId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      usdAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      usdRate: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      file: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
    },
  );

  return MarketingExpense;
};

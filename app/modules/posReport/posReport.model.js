const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const PosReport = sequelize.define(
    "PosReport",
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
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },

      amount: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      mobile: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      subTotal: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      discount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deliveryCharge: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      total: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      paidAmount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dueAmount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      items: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      // Movement-based costing: the FIFO cost of the units this sale consumed
      // (summed across all line items), frozen at sale time. NULL on rows
      // from before this column existed — Dashboard P&L only counts rows
      // where this is populated, never re-derives it from current stock.
      fifo_cost: {
        type: DataTypes.DECIMAL(12, 2),
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

  return PosReport;
};

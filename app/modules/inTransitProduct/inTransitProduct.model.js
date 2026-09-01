const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const IntransitProduct = sequelize.define(
    "IntransitProduct",
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
      purchase_price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      sale_price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      // Movement-based costing: the FIFO cost of the units this dispatch
      // consumed (line total). New dispatches get it from the cost layers;
      // historical rows are backfilled from `purchase_price`. Reports read this,
      // never the catalog.
      fifo_cost: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
      },

      quantity: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      variants: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true,
      },
      items: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      batchId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
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

  return IntransitProduct;
};

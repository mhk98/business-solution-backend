const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes, Sequelize) => {
  const Sale = sequelize.define(
    "Sale",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      product_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      buyer_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      rate: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      price: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      paid_amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      due_amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      FirstName: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      LastName: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      Address: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      Phone: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      Email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      transaction_date: {
        type: DataTypes.DATEONLY, // Store only the date
        allowNull: false,
      },
      updated_date: {
        type: DataTypes.DATEONLY, // Store only the date
        allowNull: true, // Allow manual input for updated_date if needed
        defaultValue: DataTypes.NOW, // Set to current date only on update
      },
    },
    {
      hooks: {
        beforeUpdate: (sale) => {
          // Automatically set updated_date to current date when updated
          sale.updated_date = new Date();
        },
      },
    },
  );

  return Sale;
};

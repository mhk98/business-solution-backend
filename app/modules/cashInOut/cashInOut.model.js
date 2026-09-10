const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const CashInOut = sequelize.define(
    "CashInOut",
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
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      categoryId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      bankAccount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      lender: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      loanId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      supplierId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      dollarSupplierId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      manufacturerId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      packagingManufacturerId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      ownerId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      directorId: {
        type: DataTypes.INTEGER(10),
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
      voucherNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      refNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // For Cash In vouchers: who the money was received from (free text
      // entered on the Cash In modal). The voucher's Receiver is always the
      // company for Cash In.
      fromParty: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      note: {
        type: DataTypes.STRING,
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
      employeeId: {
        type: DataTypes.INTEGER(10),
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

  return CashInOut;
};

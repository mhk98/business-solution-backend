const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const SupplierHistory = sequelize.define(
    "SupplierHistory",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      amount: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      // Links this ledger row back to the Item Purchase (Manufacture) record
      // it was created from, so editing that purchase's quantity/cost can
      // find and adjust the matching due/paid amount here instead of
      // leaving it stale. Null for rows created any other way (manual
      // supplier payments, etc.) or from before this column existed.
      manufactureId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      // Links this row back to the Book Cash Out entry that created it, so
      // editing/deleting that entry can find and sync this history row.
      // Null for rows created from other flows (e.g. Item Purchase above).
      cashInOutId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("Paid", "Unpaid"),
        allowNull: true,
        defaultValue: "Unpaid",
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

  return SupplierHistory;
};

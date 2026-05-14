module.exports = (sequelize, DataTypes) => {
  const LedgerHistory = sequelize.define(
    "LedgerHistory",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      paidAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      unpaidAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      supplierHistoryId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      cashInOutId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
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

  return LedgerHistory;
};

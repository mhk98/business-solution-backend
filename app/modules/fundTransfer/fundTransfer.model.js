module.exports = (sequelize, DataTypes) => {
  const FundTransfer = sequelize.define(
    "FundTransfer",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      fromPaymentMode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fromBankAccount: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      fromBankName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      toPaymentMode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      toBankAccount: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      toBankName: {
        type: DataTypes.STRING,
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
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "Active",
      },
      file: {
        type: DataTypes.STRING,
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

  return FundTransfer;
};

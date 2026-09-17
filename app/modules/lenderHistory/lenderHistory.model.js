module.exports = (sequelize, DataTypes) => {
  const LenderHistory = sequelize.define(
    "LenderHistory",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      loanId: { type: DataTypes.INTEGER(10), allowNull: true },
      // Denormalized lender name — lets /cash-in-out/loans/:lender keep
      // resolving legacy name-based lookups without a join.
      lender: { type: DataTypes.STRING, allowNull: true },
      bookId: { type: DataTypes.INTEGER(10), allowNull: true },
      cashInOutId: { type: DataTypes.INTEGER(10), allowNull: true },
      date: { type: DataTypes.DATEONLY, allowNull: true },
      amount: { type: DataTypes.INTEGER(10), allowNull: true },
      paymentMode: { type: DataTypes.STRING, allowNull: true },
      // "CashIn" = loan taken, "CashOut" = repayment — same convention as
      // CashInOut.paymentStatus, mirrored verbatim from the source entry.
      paymentStatus: { type: DataTypes.STRING, allowNull: true },
      remarks: { type: DataTypes.STRING, allowNull: true },
      note: { type: DataTypes.STRING, allowNull: true },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "LenderHistories",
    },
  );

  return LenderHistory;
};

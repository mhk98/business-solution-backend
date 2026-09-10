module.exports = (sequelize, DataTypes) => {
  const DollarSupplierHistory = sequelize.define(
    "DollarSupplierHistory",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      dollarSupplierId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      cashInOutId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      amount: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      // Dollar-supplier purchases are entered in USD; amount above holds the
      // computed local amount (usdAmount * usdRate).
      usdAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      usdRate: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("Paid", "Unpaid"),
        allowNull: true,
        defaultValue: "Unpaid",
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
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
      tableName: "DollarSupplierHistories",
    },
  );

  return DollarSupplierHistory;
};

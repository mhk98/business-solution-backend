module.exports = (sequelize, DataTypes) => {
  const BankAccount = sequelize.define(
    "BankAccount",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      // "Bank" | "Bkash" | "Nagad" | "Rocket" — matches the Book payment mode
      // an entry against this account is recorded under. For mobile wallets
      // bankName holds the account's display name and accountNumber the
      // wallet number.
      accountType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Bank",
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      accountNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
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

  return BankAccount;
};

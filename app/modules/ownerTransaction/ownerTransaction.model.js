module.exports = (sequelize, DataTypes) => {
  const OwnerTransaction = sequelize.define(
    "OwnerTransaction",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      ownerId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      cashInOutId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Deposit",
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Active",
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

  return OwnerTransaction;
};

module.exports = (sequelize, DataTypes) => {
  const ItemRequisition = sequelize.define(
    "ItemRequisition",
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
          notEmpty: true,
        },
      },
      itemId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      paymentMode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankAccount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      amount: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      procurement: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      remarks: {
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
      file: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
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

  return ItemRequisition;
};

module.exports = (sequelize, DataTypes) => {
  const CourierProductStock = sequelize.define(
    "CourierProductStock",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          "Pending",
          "Approval Pending",
          "Return Request",
        ),
        allowNull: false,
        defaultValue: "Pending",
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
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

  return CourierProductStock;
};

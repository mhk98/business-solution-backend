module.exports = (sequelize, DataTypes) => {
  const CourierNoEntry = sequelize.define(
    "CourierNoEntry",
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
      productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      supplierId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      warehouseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      courierNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      purchase_price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      sale_price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
      quantity: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      variants: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true,
      },
      items: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      batchId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      courierStatus: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "On the way",
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

  return CourierNoEntry;
};

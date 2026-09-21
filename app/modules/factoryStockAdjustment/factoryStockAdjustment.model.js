module.exports = (sequelize, DataTypes) => {
  const FactoryStockAdjustment = sequelize.define(
    "FactoryStockAdjustment",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      manufactureStockId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      manufacturerId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      manufacturerName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      itemId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      productId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      variant: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      variantKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: "Pcs",
        allowNull: true,
      },
      unitValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      stock: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
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

  return FactoryStockAdjustment;
};

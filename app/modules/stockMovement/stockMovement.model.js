const ApiError = require("../../../error/ApiError");

module.exports = (sequelize, DataTypes) => {
  const StockMovement = sequelize.define(
    "StockMovement",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      sourceType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sourceId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      operation: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      stockType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      stockRowId: {
        type: DataTypes.INTEGER(10),
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
      manufacturerId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      variant: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      variantKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      direction: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      quantityChange: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },
      balanceBefore: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },
      balanceAfter: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      hooks: {
        beforeUpdate: () => {
          throw new ApiError(400, "Stock movement logs are immutable");
        },
        beforeDestroy: () => {
          throw new ApiError(400, "Stock movement logs are immutable");
        },
      },
    },
  );

  return StockMovement;
};

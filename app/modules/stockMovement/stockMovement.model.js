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
      date: {
        type: DataTypes.DATEONLY,
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
      // Movement-based costing (Phase 0 — capture only, not yet read by reports).
      // IN rows: unitCost = actual per-unit purchase cost of this lot.
      // OUT rows: unitSalePrice = per-unit price charged at sale time;
      //           unitCostConsumed = per-unit FIFO cost of the units that left
      //           (provisional last-cost until Phase 1 wires the cost layers);
      //           costBreakdown = [{ layerId, qty, unitCost }] once FIFO lands.
      unitCost: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
      },
      unitSalePrice: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
      },
      unitCostConsumed: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
      },
      costBreakdown: {
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

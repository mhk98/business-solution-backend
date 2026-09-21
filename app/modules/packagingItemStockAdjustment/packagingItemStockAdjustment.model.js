module.exports = (sequelize, DataTypes) => {
  const PackagingItemStockAdjustment = sequelize.define(
    "PackagingItemStockAdjustment",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      packagingItemId: {
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
      // FIFO cost-layer draw breakdown — only set for "Out" adjustments, so
      // editing/deleting can restore the exact layers via
      // packagingFifoCostLayers.js's restoreToLayers (same pattern as
      // packagingFactory.service.js).
      costBreakdown: {
        type: DataTypes.JSON,
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

  return PackagingItemStockAdjustment;
};

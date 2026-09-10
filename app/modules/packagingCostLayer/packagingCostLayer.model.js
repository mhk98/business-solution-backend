// FIFO cost layer for packaging items — one row per inbound batch ("lot") of a
// packaging item. `remainingQty` is drawn down oldest-first (`receivedDate`) as
// stock leaves Packaging Item Stock (factory move, etc). Mirrors
// InventoryCostLayer but keyed by packagingItemId (no variants).
module.exports = (sequelize, DataTypes) => {
  const PackagingCostLayer = sequelize.define(
    "PackagingCostLayer",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      packagingItemId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      // PackagingItemPurchase | OpeningBalance | PackagingFactory (restore) ...
      sourceType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sourceMovementId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      // FIFO ordering key.
      receivedDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      originalQty: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },
      remainingQty: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },
      unitCost: {
        type: DataTypes.DECIMAL(14, 4),
        allowNull: false,
        defaultValue: 0,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: "PackagingCostLayers",
      indexes: [
        { fields: ["packagingItemId", "remainingQty"] },
        { fields: ["receivedDate"] },
        { fields: ["sourceType", "sourceMovementId"] },
      ],
    },
  );

  return PackagingCostLayer;
};

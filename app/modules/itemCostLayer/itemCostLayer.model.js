// FIFO cost layer for manufacture raw-material items — one row per inbound batch
// ("lot") of an item. `remainingQty` is drawn down oldest-first (`receivedDate`)
// as stock leaves Item Stock (Factory production, etc). Mirrors
// PackagingCostLayer, keyed by itemId (variant-blended for now).
module.exports = (sequelize, DataTypes) => {
  const ItemCostLayer = sequelize.define(
    "ItemCostLayer",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      itemId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      // ItemPurchase | OpeningBalance | PackagingMixer | Factory (restore) ...
      sourceType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sourceMovementId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
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
      tableName: "ItemCostLayers",
      indexes: [
        { fields: ["itemId", "remainingQty"] },
        { fields: ["receivedDate"] },
        { fields: ["sourceType", "sourceMovementId"] },
      ],
    },
  );

  return ItemCostLayer;
};

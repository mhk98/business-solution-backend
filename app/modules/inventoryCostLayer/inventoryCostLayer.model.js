// FIFO cost layer — one row per inbound batch of a product/variant.
// `remainingQty` is drawn down (oldest `receivedDate` first) as units leave
// stock; a layer with remainingQty > 0 is still consumable. These rows are the
// single source of truth for cost of goods sold and closing stock value.
module.exports = (sequelize, DataTypes) => {
  const InventoryCostLayer = sequelize.define(
    "InventoryCostLayer",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      productId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      // "size__color" for variant products; null for flat products.
      variantKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // What opened the layer: ReceivedProduct | ReturnProduct | OpeningBalance
      // | StockAdjustment ...
      sourceType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // The stock_movement row that opened this layer (null for OpeningBalance).
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
        type: DataTypes.DECIMAL(14, 2),
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
      indexes: [
        { fields: ["productId", "variantKey", "remainingQty"] },
        { fields: ["receivedDate"] },
        { fields: ["sourceType", "sourceMovementId"] },
      ],
    },
  );

  return InventoryCostLayer;
};

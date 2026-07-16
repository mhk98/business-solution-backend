module.exports = (sequelize, DataTypes) => {
  const PackagingItemPurchase = sequelize.define(
    "PackagingItemPurchase",
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
      supplierId: {
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
      unitCost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false,
      },
      cost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false,
      },
      allPackagingItemCost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false,
      },
      batchId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      supplierHistoryId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
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
      tableName: "PackagingItemPurchases",
    },
  );

  return PackagingItemPurchase;
};

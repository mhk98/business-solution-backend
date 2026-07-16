const ApiError = require("../../../error/ApiError");

const assertNonNegativeUnitValue = (unitValue) => {
  if (unitValue !== undefined && unitValue !== null && Number(unitValue) < 0) {
    throw new ApiError(400, "Packaging item stock cannot be negative");
  }
};

module.exports = (sequelize, DataTypes) => {
  const PackagingItemStock = sequelize.define(
    "PackagingItemStock",
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
      cost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "PackagingItemStocks",
      hooks: {
        beforeValidate: (stock) => {
          assertNonNegativeUnitValue(stock.unitValue);
        },
        beforeBulkUpdate: (options) => {
          if (
            options?.attributes &&
            Object.prototype.hasOwnProperty.call(options.attributes, "unitValue")
          ) {
            assertNonNegativeUnitValue(options.attributes.unitValue);
          }
        },
      },
    },
  );

  return PackagingItemStock;
};

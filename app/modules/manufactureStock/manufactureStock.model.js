const ApiError = require("../../../error/ApiError");

const assertNonNegativeUnitValue = (unitValue) => {
  if (unitValue !== undefined && unitValue !== null && Number(unitValue) < 0) {
    throw new ApiError(400, "Manufacturer stock cannot be negative");
  }
};

module.exports = (sequelize, DataTypes) => {
  const ManufactureStock = sequelize.define(
    "ManufactureStock",
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
      variant: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      variantKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      unitValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: "Pcs",
        allowNull: true,
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
      hooks: {
        beforeValidate: (manufactureStock) => {
          assertNonNegativeUnitValue(manufactureStock.unitValue);
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

  return ManufactureStock;
};

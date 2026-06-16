const validator = require("validator");
const bcrypt = require("bcryptjs");
const ApiError = require("../../../error/ApiError");

const assertNonNegativeQuantity = (quantity) => {
  if (quantity !== undefined && quantity !== null && Number(quantity) < 0) {
    throw new ApiError(400, "Inventory cannot be negative");
  }
};

const parseVariants = (variants) => {
  if (Array.isArray(variants)) return variants;
  if (typeof variants !== "string") return [];

  try {
    const parsed = JSON.parse(variants);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const assertNonNegativeVariants = (variants) => {
  parseVariants(variants).forEach((variant) => {
    if (Number(variant?.quantity || 0) < 0) {
      throw new ApiError(400, "Inventory variant cannot be negative");
    }
  });
};

module.exports = (sequelize, DataTypes) => {
  const InventoryMaster = sequelize.define(
    "InventoryMaster",
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
          notEmpty: true, // Ensure name is not empty
        },
      },
      sku: {
        type: DataTypes.STRING,
        defaultValue: "",
        allowNull: true,
      },
      weight: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      productId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      minimumStock: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      variants: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true,
      },
      purchase_price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      sale_price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
      hooks: {
        beforeValidate: (inventory) => {
          assertNonNegativeQuantity(inventory.quantity);
          assertNonNegativeVariants(inventory.variants);
        },
        beforeBulkUpdate: (options) => {
          if (
            options?.attributes &&
            Object.prototype.hasOwnProperty.call(options.attributes, "quantity")
          ) {
            assertNonNegativeQuantity(options.attributes.quantity);
          }
          if (
            options?.attributes &&
            Object.prototype.hasOwnProperty.call(options.attributes, "variants")
          ) {
            assertNonNegativeVariants(options.attributes.variants);
          }
        },
      },
    },
  );

  return InventoryMaster;
};

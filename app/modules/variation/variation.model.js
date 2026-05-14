const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const Variation = sequelize.define(
    "Variation",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      size: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      color: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      weight: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
      tableName: "Variations",
    },
  );

  return Variation;
};

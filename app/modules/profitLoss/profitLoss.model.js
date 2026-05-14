module.exports = (sequelize, DataTypes) => {
  const ProfitLoss = sequelize.define(
    "ProfitLoss",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      mode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "product",
        validate: {
          isIn: [["product", "user", "auto"]],
        },
      },
      salesType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      products: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },

      purchase: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },
      revenue: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },
      return: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },

      cost: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },

      profitLoss: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Active",
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
    },
  );

  return ProfitLoss;
};

module.exports = (sequelize, DataTypes) => {
  const ManufactureProduction = sequelize.define(
    "ManufactureProduction",
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
        allowNull: false,
      },
      manufacturerName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      itemId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
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
    },
  );

  return ManufactureProduction;
};

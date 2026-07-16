module.exports = (sequelize, DataTypes) => {
  const PackagingManufacturerTransaction = sequelize.define(
    "PackagingManufacturerTransaction",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      manufacturerId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      manufacturerName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mixerId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      debit: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },
      credit: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
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
      tableName: "PackagingManufacturerTransactions",
    },
  );

  return PackagingManufacturerTransaction;
};

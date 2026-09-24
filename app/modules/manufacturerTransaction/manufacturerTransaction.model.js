module.exports = (sequelize, DataTypes) => {
  const ManufacturerTransaction = sequelize.define(
    "ManufacturerTransaction",
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
      // Links this row back to the Book Cash Out entry that created it, so
      // editing/deleting that entry can find and sync this transaction row.
      cashInOutId: {
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
    },
  );

  return ManufacturerTransaction;
};

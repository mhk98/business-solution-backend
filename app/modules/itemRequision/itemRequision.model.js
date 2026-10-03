module.exports = (sequelize, DataTypes) => {
  const ItemRequisition = sequelize.define(
    "ItemRequisition",
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
      // Null for an "Others Cost" line (see entryType).
      itemId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      // "Item" (default) or "Others Cost": a supplier charge with no item —
      // it posts only a supplier due on receipt, never Item Stock.
      // `amount` is the product cost (Item Stock unit cost = amount ÷ qty);
      // `othersCost` (transport, labour, …) is added only to the supplier due.
      entryType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Item",
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      paymentMode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bankAccount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      unit: {
        type: DataTypes.STRING,
        defaultValue: "Pcs",
        allowNull: true,
      },
      amount: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      othersCost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      procurement: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      file: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // True for requisitions created after receiving started posting Item
      // Stock + supplier due. Older rows were handled through Item Purchase and
      // never post either.
      supplierDueTracked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // The Item Purchase created when this line was received.
      manufactureId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
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

  return ItemRequisition;
};

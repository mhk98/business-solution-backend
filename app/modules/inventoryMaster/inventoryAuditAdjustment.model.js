// "Keep Current" on the Stock Audit: when a Stock Product quantity was
// corrected by hand (e.g. directly in the DB), the difference from the
// movement-derived quantity is stored here so the reconciler treats the edited
// quantity as the expected one instead of overwriting it. Shaped like a
// movement row (`quantity` or `variants[{size,color,quantity}]`, signed).
// It only affects the reconciled quantity — no purchase, cost or report rows.
module.exports = (sequelize, DataTypes) => {
  const InventoryAuditAdjustment = sequelize.define(
    "InventoryAuditAdjustment",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      productId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      },
      variants: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER(10),
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

  return InventoryAuditAdjustment;
};

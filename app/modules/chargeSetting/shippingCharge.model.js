module.exports = (sequelize, DataTypes) => {
  const ShippingCharge = sequelize.define(
    "ShippingCharge",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // "manual" for rows added from the settings screen, "cs_work_report" for
      // rows synced from an EmployeeWorkReport submission.
      source: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "manual",
      },
      employeeId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      employeeWorkReportId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      createdByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      createdByRole: {
        type: DataTypes.STRING(32),
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
      tableName: "ShippingCharges",
    },
  );

  return ShippingCharge;
};

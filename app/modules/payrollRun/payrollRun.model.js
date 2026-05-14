module.exports = (sequelize, DataTypes) => {
  const PayrollRun = sequelize.define(
    "PayrollRun",
    {
      Id: { type: DataTypes.INTEGER(10), primaryKey: true, autoIncrement: true, allowNull: false },
      month: { type: DataTypes.STRING(7), allowNull: false },
      title: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING(32), allowNull: true, defaultValue: "Draft" },
      totalEmployees: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      grossAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      deductionAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      netAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      generatedAt: { type: DataTypes.DATE, allowNull: true },
      finalizedAt: { type: DataTypes.DATE, allowNull: true },
      note: { type: DataTypes.STRING, allowNull: true },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { timestamps: true, paranoid: true },
  );
  return PayrollRun;
};

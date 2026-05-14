module.exports = (sequelize, DataTypes) => {
  const KPI = sequelize.define(
    "KPI",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      employeeId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      departmentId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      designationId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      teamId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      designationType: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      periodType: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      periodStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      periodEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      confirmRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      deliveredRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      returnParcentRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      lateRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      absentRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      leaveRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      workingTimeRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      qcRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      overallBaviourRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      totalSaleAmountRaw: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      confirm: {
        type: DataTypes.STRING,
        defaultValue: 0,
        allowNull: true,
      },
      delivered: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      returnParcent: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      late: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      absent: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      leave: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      workingTime: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      qc: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      overallBaviour: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: true,
      },
      totalSaleAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
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

  return KPI;
};

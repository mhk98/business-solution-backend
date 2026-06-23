module.exports = (sequelize, DataTypes) => {
  const LogisticUpdate = sequelize.define(
    "LogisticUpdate",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      updateType: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "LogisticUpdates",
      indexes: [
        { fields: ["startDate", "endDate"] },
        { fields: ["updateType"] },
        { fields: ["userId"] },
      ],
    },
  );

  return LogisticUpdate;
};

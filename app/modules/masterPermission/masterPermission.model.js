module.exports = (sequelize, DataTypes) => {
  const MasterPermission = sequelize.define(
    "MasterPermission",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
      },
      createdByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
    },
    {
      timestamps: true,
    },
  );

  return MasterPermission;
};

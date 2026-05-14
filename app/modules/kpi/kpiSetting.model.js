module.exports = (sequelize, DataTypes) => {
  const KPISetting = sequelize.define(
    "KPISetting",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      key: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      label: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      rules: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      timestamps: true,
      paranoid: true,
      tableName: "KPISettings",
    },
  );

  return KPISetting;
};

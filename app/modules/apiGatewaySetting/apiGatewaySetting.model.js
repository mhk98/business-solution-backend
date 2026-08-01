module.exports = (sequelize, DataTypes) => {
  const ApiGatewaySetting = sequelize.define(
    "ApiGatewaySetting",
    {
      Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      gatewayType: {
        type: DataTypes.ENUM("sms", "email"),
        allowNull: false,
        unique: true,
      },
      isEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      config: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "ApiGatewaySettings",
      timestamps: true,
      paranoid: true,
    },
  );

  return ApiGatewaySetting;
};

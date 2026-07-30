module.exports = (sequelize, DataTypes) => {
  const StellarAttendanceLog = sequelize.define(
    "StellarAttendanceLog",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      accessId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      registrationId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      logDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      logTime: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      logDateTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deviceName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      deviceId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      card: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      rawPayload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true,
      indexes: [
        { fields: ["registrationId"] },
        { fields: ["logDate"] },
        { fields: ["logDateTime"] },
      ],
    },
  );

  return StellarAttendanceLog;
};

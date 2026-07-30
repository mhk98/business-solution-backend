module.exports = (sequelize, DataTypes) => {
  const StellarAttendanceSyncState = sequelize.define(
    "StellarAttendanceSyncState",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      syncKey: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      nextAllowedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastStatus: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      lastMessage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
    },
  );

  return StellarAttendanceSyncState;
};

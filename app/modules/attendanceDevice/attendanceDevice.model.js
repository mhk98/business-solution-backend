module.exports = (sequelize, DataTypes) => {
  const AttendanceDevice = sequelize.define(
    "AttendanceDevice",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      brand: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: "ZKTeco",
      },
      model: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: "SpeedFace-V5L",
      },
      serialNumber: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      deviceIdentifier: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      apiKey: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      branch: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      syncMethod: {
        type: DataTypes.STRING(64),
        allowNull: true,
        defaultValue: "WDMS",
      },
      lastSyncAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Planned",
      },
      pendingAction: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      approvalNote: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      requestedByUserId: {
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

  return AttendanceDevice;
};

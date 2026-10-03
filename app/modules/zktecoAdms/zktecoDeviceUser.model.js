// Users enrolled on a ZKTeco ADMS device, as the device itself reports them
// (USERINFO query / user add-change pushes). `pin` is the device's User ID —
// the same value its punches carry as AttendancePunch.employeePin.
module.exports = (sequelize, DataTypes) => {
  const ZktecoDeviceUser = sequelize.define(
    "ZktecoDeviceUser",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      serialNumber: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      pin: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      privilege: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      card: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      // Last time the device reported this user; a full USERINFO query
      // removes users it no longer lists.
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      indexes: [{ unique: true, fields: ["serialNumber", "pin"] }],
    },
  );

  return ZktecoDeviceUser;
};

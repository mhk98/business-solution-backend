// One raw punch. Device punches (ZKTeco ADMS) carry the device PIN and are
// matched to a user at compute time (Users.attendancePin, falling back to the
// user's Id), so fixing a PIN later re-attributes old punches. Manual /
// regularization punches carry userId directly.
//
// punchDate + punchClock are Bangladesh local time exactly as the device
// reported it — the engine works on these, never on server-local time.
module.exports = (sequelize, DataTypes) => {
  const AttendancePunch = sequelize.define(
    "AttendancePunch",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      // sha1(serial|pin|datetime) for device punches — a re-sent punch
      // upserts onto the same row. "manual:…" / "reg:<id>:in" otherwise.
      punchKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      employeePin: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      punchDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      punchClock: {
        type: DataTypes.STRING(8),
        allowNull: false,
      },
      punchAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // device | manual | regularization
      source: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "device",
      },
      deviceSerial: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      deviceName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      verifyMode: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      regularizationId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      rawPayload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [
        { fields: ["punchDate"] },
        { fields: ["employeePin", "punchDate"] },
        { fields: ["userId", "punchDate"] },
      ],
    },
  );
  return AttendancePunch;
};

// Diagnostic trail of what ZKTeco devices send to /iclock and what we answer
// (routine "OK" polls are skipped). Kept for two days.
module.exports = (sequelize, DataTypes) => {
  const ZktecoAdmsTrace = sequelize.define(
    "ZktecoAdmsTrace",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      serialNumber: { type: DataTypes.STRING(64), allowNull: true },
      method: { type: DataTypes.STRING(8), allowNull: true },
      path: { type: DataTypes.STRING(255), allowNull: true },
      query: { type: DataTypes.TEXT, allowNull: true },
      contentType: { type: DataTypes.STRING(128), allowNull: true },
      bodyLength: { type: DataTypes.INTEGER(10), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.INTEGER(5), allowNull: true },
      response: { type: DataTypes.TEXT, allowNull: true },
      ipAddress: { type: DataTypes.STRING(64), allowNull: true },
    },
    { timestamps: true },
  );

  return ZktecoAdmsTrace;
};

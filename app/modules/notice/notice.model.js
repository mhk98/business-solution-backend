module.exports = (sequelize, DataTypes) => {
  const Notice = sequelize.define(
    "Notice",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Active",
      },
      createdByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      createdByRole: {
        type: DataTypes.STRING(32),
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
      tableName: "Notices",
    },
  );

  return Notice;
};

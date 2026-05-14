module.exports = (sequelize, DataTypes) => {
  const LeaveType = sequelize.define(
    "LeaveType",
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
      isPaid: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      daysPerYear: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      carryForward: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "Active",
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

  return LeaveType;
};

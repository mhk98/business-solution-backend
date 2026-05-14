module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define(
    "Task",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      assignedToUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      assignedByUserId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      priority: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Normal",
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Pending",
      },
      dueDate: {
        type: DataTypes.DATEONLY,
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
      tableName: "Tasks",
    },
  );

  return Task;
};

module.exports = (sequelize, DataTypes) => {
  const DirectorProfitShare = sequelize.define(
    "DirectorProfitShare",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      directorId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      cashInOutId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "Invest",
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
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

  return DirectorProfitShare;
};

module.exports = (sequelize, DataTypes) => {
  const CompanyInfo = sequelize.define(
    "CompanyInfo",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hotline: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      website: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      whatsapp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
    },
  );

  return CompanyInfo;
};

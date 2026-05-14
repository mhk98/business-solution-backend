const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define(
    "Employee",
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
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      employee_id: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      employeeListId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      departmentId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      basic_salary: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      incentive: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      holiday_payment: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      total_salary: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      advance: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      late: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      early_leave: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      absent: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      friday_absent: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      unapproval_absent: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      net_salary: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bookId: {
        type: DataTypes.INTEGER(10),
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
      tableName: "Employees",
    },
  );

  return Employee;
};

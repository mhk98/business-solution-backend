const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const EmployeeList = sequelize.define(
    "EmployeeList",
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
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      employeeCode: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      departmentId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      designationId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      shiftId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      reportingManagerId: {
        type: DataTypes.INTEGER(10),
        allowNull: true,
      },
      employmentType: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      joiningDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      salary: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
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
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
      tableName: "EmployeeLists",
    },
  );

  return EmployeeList;
};

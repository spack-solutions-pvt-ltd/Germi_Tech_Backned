"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Employee extends Model {
    static associate(models) {
      this.belongsTo(models.Role, { foreignKey: "roleId", as: "role" });

      this.hasMany(models.EmployeeDocument, {
        foreignKey: "employeeId",
        as: "documents",
        onDelete: "CASCADE",
      });

      this.hasMany(models.EmployeeInsurance, {
        foreignKey: "employeeId",
        as: "insurances",
        onDelete: "CASCADE",
      });

      // Direct, per-employee permission overrides (on top of their Role).
      this.belongsToMany(models.Permission, {
        through: models.IndividualPermission,
        foreignKey: "employeeId",
        as: "individualPermissions",
      });
    }
  }

  Employee.init(
    {
      empId: DataTypes.STRING,
      name: DataTypes.STRING,
      number: DataTypes.STRING,
      alternateNumber: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      level: DataTypes.ENUM("L1", "L2", "L3"),
      roleId: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
      resetPasswordToken: DataTypes.STRING,
      resetPasswordExpires: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Employee",
    },
  );

  return Employee;
};

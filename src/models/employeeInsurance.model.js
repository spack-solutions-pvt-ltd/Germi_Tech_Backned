"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeeInsurance extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "employeeId",
        as: "insurances",
      });
    }
  }

  EmployeeInsurance.init(
    {
      employeeId: DataTypes.INTEGER,
      type: DataTypes.ENUM("health", "life", "bike", "accidental"),
      provider: DataTypes.STRING,
      startDate: DataTypes.DATEONLY,
      expiryDate: DataTypes.DATEONLY,
      amount: DataTypes.DECIMAL(12, 2),
    },
    {
      sequelize,
      modelName: "EmployeeInsurance",
    },
  );

  return EmployeeInsurance;
};

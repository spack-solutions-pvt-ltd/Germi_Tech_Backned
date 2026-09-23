"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeeInsurance extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "employeeId",
        as: "employee",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "updatedBy",
        as: "updater",
      });
    }
  }

  EmployeeInsurance.init(
    {
      employeeId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM("health", "life", "bike", "accidental", "other"),
        allowNull: false,
      },
      // Custom name typed in when type = "other" (same pattern as
      // EmployeeDocument.label for its "Others" option).
      otherTypeName: DataTypes.STRING(150),
      provider: DataTypes.STRING(150),
      startDate: DataTypes.DATEONLY,
      expiryDate: DataTypes.DATEONLY,
      amount: DataTypes.DECIMAL(12, 2),
      updatedBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "EmployeeInsurance",
    },
  );

  return EmployeeInsurance;
};

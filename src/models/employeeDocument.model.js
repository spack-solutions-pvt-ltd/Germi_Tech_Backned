"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeeDocument extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "employeeId",
        as: "documents",
      });
    }
  }

  EmployeeDocument.init(
    {
      employeeId: DataTypes.INTEGER,
      type: DataTypes.ENUM("aadhar", "drivers_license", "rc", "other"),
      label: DataTypes.STRING,
      documentNumber: DataTypes.STRING,
      fileUrl: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "EmployeeDocument",
    },
  );

  return EmployeeDocument;
};

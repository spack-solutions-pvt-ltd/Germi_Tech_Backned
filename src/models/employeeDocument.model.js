"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeeDocument extends Model {
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

  EmployeeDocument.init(
    {
      employeeId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM(
          "aadhaar_card",
          "pan_card",
          "drivers_license",
          "rc",
          "other",
        ),
        allowNull: false,
      },
      label: DataTypes.STRING(150),
      documentNumber: DataTypes.STRING(100),
      fileUrl: DataTypes.STRING(500),
      originalFileName: DataTypes.STRING(255),
      updatedBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "EmployeeDocument",
    },
  );

  return EmployeeDocument;
};

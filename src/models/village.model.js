"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Village extends Model {
    static associate(models) {
      this.hasMany(models.SubOrganizer, {
        foreignKey: "villageId",
        as: "subOrganizers",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "createdBy",
        as: "creator",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "updatedBy",
        as: "updatedEmp",
      });

      this.hasMany(models.AllotmentVillage, {
        foreignKey: "villageId",
        as: "allotmentVillages",
      });
      // this.belongsToMany(models.Employee, {
      //   through: models.VillageSupervisor,
      //   foreignKey: "villageId",
      //   otherKey: "employeeId",
      //   as: "supervisors",
      // });
    }
  }

  Village.init(
    {
      villageId: DataTypes.STRING(30),
      name: DataTypes.STRING(150),
      mandal: DataTypes.STRING(100),
      district: DataTypes.STRING(100),
      pincode: DataTypes.STRING(10),
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
      createdBy: DataTypes.INTEGER,
      updatedBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Village",
    },
  );

  return Village;
};

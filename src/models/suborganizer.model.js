"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SubOrganizer extends Model {
    static associate(models) {
      this.belongsTo(models.Village, {
        foreignKey: "villageId",
        as: "village",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "createdBy",
        as: "creator",
      });
      this.hasMany(models.AllotmentVillage, {
        foreignKey: "subOrganizerId",
        as: "allotmentVillages",
      });
    }
  }

  SubOrganizer.init(
    {
      subOrganizerId: DataTypes.STRING(30),
      villageId: DataTypes.INTEGER,
      name: DataTypes.STRING(150),
      number: DataTypes.STRING(15),
      acres: DataTypes.DECIMAL(10, 2),
      createdBy: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      sequelize,
      modelName: "SubOrganizer",
    },
  );

  return SubOrganizer;
};

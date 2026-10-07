"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class LaborGroup extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "createdBy",
        as: "creator",
      });
      this.hasMany(models.LaborGroupCropRate, {
        foreignKey: "laborGroupId",
        as: "cropRates",
        onDelete: "CASCADE",
      });

    }
  }

  LaborGroup.init(
    {
      laborGroupId: DataTypes.STRING(30),
      name: DataTypes.STRING,
      contactNumber: DataTypes.STRING,
      upiNumber: DataTypes.STRING,
      createdBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "LaborGroup",
    },
  );

  return LaborGroup;
};

"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Crop extends Model {
    static associate(models) {
      this.hasMany(models.CompanyCrop, {
        foreignKey: "cropId",
        as: "companyCrops",
      });
      this.hasMany(models.LaborGroupCropRate, {
        foreignKey: "cropId",
        as: "laborGroupRates",
      });
    }
  }

  Crop.init(
    {
      cropId: DataTypes.STRING,
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      description: DataTypes.TEXT,
      duration: DataTypes.STRING(50),
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
      season: {
        type: DataTypes.ENUM("Kharif", "Rabi"),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Crop",
    },
  );

  return Crop;
};

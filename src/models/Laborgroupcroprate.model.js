"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // "Price per Person and crop wise" — one rate row per crop a labor group
  // has a price set for.
  class LaborGroupCropRate extends Model {
    static associate(models) {
      this.belongsTo(models.LaborGroup, {
        foreignKey: "laborGroupId",
        as: "laborGroup",
      });
      this.belongsTo(models.Crop, { foreignKey: "cropId", as: "crop" });
    }
  }

  LaborGroupCropRate.init(
    {
      laborGroupId: DataTypes.INTEGER,
      cropId: DataTypes.INTEGER,
      pricePerPerson: DataTypes.DECIMAL(10, 2),
    },
    {
      sequelize,
      modelName: "LaborGroupCropRate",
      tableName: "labor_group_crop_rates",
      indexes: [{ unique: true, fields: ["laborGroupId", "cropId"] }],
    },
  );

  return LaborGroupCropRate;
};

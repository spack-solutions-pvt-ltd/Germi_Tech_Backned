"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // Only used for type='request'. One Allotment(-Village) dropdown per row,
  // same pattern as LabourRequestCropEntry.
  class BagsRequestCropEntry extends Model {
    static associate(models) {
      this.belongsTo(models.BagsRequest, { foreignKey: "bagsRequestId", as: "bagsRequest" });
      this.belongsTo(models.AllotmentVillage, { foreignKey: "allotmentVillageId", as: "allotmentVillage" });
    }
  }

  BagsRequestCropEntry.init(
    {
      bagsRequestId: DataTypes.INTEGER,
      allotmentVillageId: DataTypes.INTEGER,
      requiredBags: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "BagsRequestCropEntry",
    }
  );

  return BagsRequestCropEntry;
};
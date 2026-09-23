"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // One row per "Add crop" entry. allotmentVillageId is the single dropdown
  // that replaces separate Village/Crop/Variety selects — it already
  // carries all three via Allotment -> CompanyCrop -> Crop and -> Village.
  class LabourRequestCropEntry extends Model {
    static associate(models) {
      this.belongsTo(models.LabourRequest, { foreignKey: "labourRequestId", as: "labourRequest" });
      this.belongsTo(models.AllotmentVillage, { foreignKey: "allotmentVillageId", as: "allotmentVillage" });
    }
  }

  LabourRequestCropEntry.init(
    {
      labourRequestId: DataTypes.INTEGER,
      allotmentVillageId: DataTypes.INTEGER,
      labourCount: DataTypes.INTEGER,
      totalAcres: DataTypes.DECIMAL(10, 2),
      acresWorked: DataTypes.DECIMAL(10, 2),
      rowingTime: DataTypes.ENUM("1st", "2nd", "3rd"),
    },
    {
      sequelize,
      modelName: "LabourRequestCropEntry",
    }
  );

  return LabourRequestCropEntry;
};

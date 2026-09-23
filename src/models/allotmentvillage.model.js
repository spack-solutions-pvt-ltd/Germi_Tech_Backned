"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // One row per village a given Allotment has been split across.
  class AllotmentVillage extends Model {
    static associate(models) {
      this.belongsTo(models.Allotment, { foreignKey: "allotmentId", as: "allotment" });
      this.belongsTo(models.Village, { foreignKey: "villageId", as: "village" });
      this.belongsTo(models.SubOrganizer, { foreignKey: "subOrganizerId", as: "subOrganizer" });
      this.belongsTo(models.Employee, { foreignKey: "supervisorId", as: "supervisor" });
      this.hasMany(models.LabourRequestCropEntry, { foreignKey: "allotmentVillageId", as: "labourCropEntries" });
    }
  }

  AllotmentVillage.init(
    {
      allotmentId: DataTypes.INTEGER,
      allotmentVillageId:DataTypes.STRING,
      villageId: DataTypes.INTEGER,
      subOrganizerId: DataTypes.INTEGER,
      supervisorId: DataTypes.INTEGER,
      allottedAcres: DataTypes.DECIMAL(10, 2),
      standingAcres: DataTypes.DECIMAL(10, 2),
      gpsPendingAcres: DataTypes.DECIMAL(10, 2),
    },
    {
      sequelize,
      modelName: "AllotmentVillage",
    }
  );

  return AllotmentVillage;
};
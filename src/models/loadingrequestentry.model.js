"use strict";
const { Model } = require("sequelize");
const { fileUrlAttribute } = require("../utils/fileUrlAttribute");

module.exports = (sequelize, DataTypes) => {
  // One "Loading N" row. The allotment carries village -> crop -> variety;
  // supervisorId is the allotment's supervisor ("Self" = the requester).
  class LoadingRequestEntry extends Model {
    static associate(models) {
      this.belongsTo(models.LoadingRequest, { foreignKey: "loadingRequestId", as: "loadingRequest" });
      this.belongsTo(models.AllotmentVillage, { foreignKey: "allotmentVillageId", as: "allotmentVillage" });
      this.belongsTo(models.Employee, { foreignKey: "supervisorId", as: "supervisor" });
    }
  }

  LoadingRequestEntry.init(
    {
      loadingRequestId: DataTypes.INTEGER,
      allotmentVillageId: DataTypes.INTEGER,
      supervisorId: DataTypes.INTEGER,
      noOfBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      dkQuantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, // charged weight (kgs)
      dkPhotoUrl: fileUrlAttribute(DataTypes, "dkPhotoUrl"), // S3 key (or legacy /uploads path); reads return the viewable URL
      dkPhotoName: DataTypes.STRING(255), // original file name, e.g. "dk-slip.jpg"
    },
    {
      sequelize,
      modelName: "LoadingRequestEntry",
    }
  );

  return LoadingRequestEntry;
};

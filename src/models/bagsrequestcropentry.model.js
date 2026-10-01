"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // One row per "Add crop" entry of a BagsRequest. One Allotment(-Village)
  // dropdown per row, same pattern as LabourRequestCropEntry.
  //
  // Quantities are kept separately — L2 may send less OR more than required,
  // across as many dispatches as needed:
  //   requiredBags  — what the supervisor asked for (L2 may correct it)
  //   sentBags      — the dispatch currently in transit (awaiting Received / Not Received)
  //   receivedBags  — cumulative bags the supervisor has confirmed
  //   remaining     = max(requiredBags - receivedBags - sentBags, 0)
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
      requiredBags: { type: DataTypes.INTEGER, allowNull: false },
      sentBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      receivedBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: "BagsRequestCropEntry",
    }
  );

  return BagsRequestCropEntry;
};

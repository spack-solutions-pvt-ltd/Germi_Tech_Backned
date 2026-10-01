"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // Running bag inventory per supervisor per allotment-village ("Bags with
  // him"). Only ever changed through utils/bagsBalance.js so availableBags
  // stays consistent:
  //
  //   available = allotted + received + sharedIn - returned - sharedOut - used
  class BagsBalance extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "supervisorId", as: "supervisor" });
      this.belongsTo(models.AllotmentVillage, { foreignKey: "allotmentVillageId", as: "allotmentVillage" });
    }
  }

  BagsBalance.init(
    {
      supervisorId: { type: DataTypes.INTEGER, allowNull: false },
      allotmentVillageId: { type: DataTypes.INTEGER, allowNull: false },
      allottedBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // opening stock, if any
      receivedBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // BagsRequest -> Received
      sharedInBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // incoming shared transfer -> Received
      returnedBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // return transfer -> Received
      sharedOutBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // outgoing shared transfer -> Received
      usedBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // consumption — wired up later
      availableBags: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: "BagsBalance",
      indexes: [{ unique: true, fields: ["supervisorId", "allotmentVillageId"] }],
    }
  );

  return BagsBalance;
};

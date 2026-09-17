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
      // Payments History (Labor Payments) is a bigger ledger feature of its
      // own — ID, Requested/Approved/Processed By, Amount, Mode, plus the
      // nested advance/paid/due + bags/DK-qty/Kanta-bill sub-ledger.
    }
  }

  LaborGroup.init(
    {
      laborGroupId: DataTypes.STRING(30),
      name: DataTypes.STRING(150),
      contactNumber: DataTypes.STRING(15),
      upiNumber: DataTypes.STRING(50),
      createdBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "LaborGroup",
    },
  );

  return LaborGroup;
};

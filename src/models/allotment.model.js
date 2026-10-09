"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Allotment extends Model {
    static associate(models) {
      this.belongsTo(models.SeedCompany, {
        foreignKey: "companyId",
        as: "company",
      });
      this.belongsTo(models.CompanyCrop, {
        foreignKey: "companyCropId",
        as: "companyCrop",
      });
      this.hasMany(models.AllotmentVillage, {
        foreignKey: "allotmentId",
        as: "villageAllotments",
        onDelete: "CASCADE",
      });
    }
  }

  Allotment.init(
    {
      allotmentId: DataTypes.STRING(30),
      companyId: DataTypes.INTEGER,
      companyCropId: DataTypes.INTEGER,
      reqAcres: DataTypes.DECIMAL(10, 2),
      reqQtyKgs: DataTypes.DECIMAL(10, 2),
      season: { type: DataTypes.ENUM("Kharif", "Rabi"), allowNull: false },
      year: DataTypes.STRING(10), // crop year, e.g. "25-26" (Kharif 25-26 = Jun–Oct 2025, Rabi 25-26 = Nov 2025–May 2026)
      status: {
        type: DataTypes.ENUM("open", "closed"),
        allowNull: false,
        defaultValue: "open",
      },
    },
    {
      sequelize,
      modelName: "Allotment",
    },
  );

  return Allotment;
};

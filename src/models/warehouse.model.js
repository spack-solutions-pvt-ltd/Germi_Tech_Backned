"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Warehouse extends Model {
    static associate(models) {
      this.belongsTo(models.SeedCompany, {
        foreignKey: "companyId",
        as: "company",
      });
    }
  }

  Warehouse.init(
    {
      warehouseId: DataTypes.STRING,
      companyId: DataTypes.INTEGER,
      locationName: DataTypes.STRING(150),
      pocName: DataTypes.STRING(150),
      pocNumber: DataTypes.STRING(15),
      locationLink: DataTypes.STRING(500), // e.g. Google Maps URL
    },
    {
      sequelize,
      modelName: "Warehouse",
    },
  );

  return Warehouse;
};

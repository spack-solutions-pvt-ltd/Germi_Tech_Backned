"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SeedCompany extends Model {
    static associate(models) {
      this.hasMany(models.Warehouse, {
        foreignKey: "companyId",
        as: "warehouses",
        onDelete: "CASCADE",
      });
      this.hasMany(models.CompanyCrop, {
        foreignKey: "companyId",
        as: "companyCrops",
        onDelete: "CASCADE",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "createdBy",
        as: "creator",
      });
      this.belongsTo(models.State, { foreignKey: "stateId", as: "state" });
      this.hasMany(models.Allotment, {
        foreignKey: "companyId",
        as: "allotments",
      });
    }
  }

  SeedCompany.init(
    {
      companyId: DataTypes.STRING,
      name: DataTypes.STRING(150),
      number: DataTypes.INTEGER,
      email: DataTypes.STRING(150),
      pocName: DataTypes.STRING(150),
      pocNumber: DataTypes.INTEGER,
      fullAddress: DataTypes.STRING(500),
      district: DataTypes.STRING(100),
      pincode: DataTypes.STRING(10),
      stateId: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
      createdBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "SeedCompany",
    },
  );

  return SeedCompany;
};

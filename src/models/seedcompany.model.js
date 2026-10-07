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
      name: DataTypes.STRING,
      number: DataTypes.STRING,
      email: DataTypes.STRING,
      pocName: DataTypes.STRING,
      pocNumber: DataTypes.STRING,
      fullAddress: DataTypes.STRING,
      district: DataTypes.STRING,
      pincode: DataTypes.STRING,
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

"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // Represents one seed variety a specific company offers for a specific
  // crop — the "Seed Varieties" table on a company's view page.
  class CompanyCrop extends Model {
    static associate(models) {
      this.belongsTo(models.SeedCompany, {
        foreignKey: "companyId",
        as: "company",
      });
      this.belongsTo(models.Crop, { foreignKey: "cropId", as: "crop" });
      this.hasMany(models.Allotment, {
        foreignKey: "companyCropId",
        as: "allotments",
      });
    }
  }

  CompanyCrop.init(
    {
      companyCropId: DataTypes.STRING,
      companyId: DataTypes.INTEGER,
      cropId: DataTypes.INTEGER,
      varietyName: DataTypes.STRING(150),
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      sequelize,
      modelName: "CompanyCrop",
      tableName: "company_crops",
      indexes: [
        { unique: true, fields: ["companyId", "cropId", "varietyName"] },
      ],
    },
  );

  return CompanyCrop;
};

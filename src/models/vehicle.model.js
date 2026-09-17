"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    static associate(models) {
      this.belongsTo(models.LogisticsPartner, {
        foreignKey: "logisticsPartnerId",
        as: "logisticsPartner",
      });
    }
  }

  Vehicle.init(
    {
      logisticsPartnerId: DataTypes.INTEGER,
      vehicleId: DataTypes.STRING,
      type: DataTypes.STRING(100),
      regNo: DataTypes.STRING(30),
      capacity: DataTypes.STRING(50),
      driverName: DataTypes.STRING(150),
      driverNumber: DataTypes.STRING(15),
    },
    {
      sequelize,
      modelName: "Vehicle",
    },
  );

  return Vehicle;
};

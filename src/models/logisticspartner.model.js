"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class LogisticsPartner extends Model {
    static associate(models) {
      this.hasMany(models.Vehicle, {
        foreignKey: "logisticsPartnerId",
        as: "vehicles",
        onDelete: "CASCADE",
      });
      this.belongsTo(models.State, { foreignKey: "stateId", as: "state" });
    }
  }

  LogisticsPartner.init(
    {
      logisticsId: DataTypes.STRING(30),
      name: DataTypes.STRING(150),
      ownerName: DataTypes.STRING(150),
      ownerNumber: DataTypes.STRING(15),
      rate: DataTypes.DECIMAL(10, 2),
      fullAddress: DataTypes.STRING(500),
      location: DataTypes.STRING(255),
      pincode: DataTypes.STRING(10),
      stateId: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      sequelize,
      modelName: "LogisticsPartner",
    },
  );

  return LogisticsPartner;
};

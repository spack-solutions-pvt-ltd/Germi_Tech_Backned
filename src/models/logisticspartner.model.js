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
      logisticsId: DataTypes.STRING,
      name: DataTypes.STRING,
      ownerName: DataTypes.STRING,
      ownerNumber: DataTypes.STRING,
      rate: DataTypes.DECIMAL(10, 2),
      fullAddress: DataTypes.STRING,
      location: DataTypes.STRING,
      pincode: DataTypes.STRING,
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

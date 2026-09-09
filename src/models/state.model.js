"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class State extends Model {
    static associate(models) {
      this.hasMany(models.Village, { foreignKey: "stateId", as: "villages" });
    }
  }

  State.init(
    {
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    },
    {
      sequelize,
      modelName: "State",
    },
  );

  return State;
};

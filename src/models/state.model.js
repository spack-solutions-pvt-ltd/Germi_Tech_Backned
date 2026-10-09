"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class State extends Model {
    static associate(models) {
    }
  }

  State.init(
    {
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
    },
    {
      sequelize,
      modelName: "State",
    },
  );

  return State;
};

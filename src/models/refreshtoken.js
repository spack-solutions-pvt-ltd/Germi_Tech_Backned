"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  RefreshToken.init(
    {
      userId: DataTypes.INTEGER,
      type: DataTypes.STRING,
      expire: DataTypes.DATE,
      token: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "RefreshToken",
    },
  );
  return RefreshToken;
};

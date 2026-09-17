"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {

  class RefreshToken extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "employeeId", as: "employee" });
    }
  }

  RefreshToken.init(
    {
      employeeId: DataTypes.INTEGER,
      tokenHash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      replacedByTokenHash: { type: DataTypes.STRING(128), allowNull: true },
    },
    {
      sequelize,
      modelName: "RefreshToken",
    }
  );

  return RefreshToken;
};
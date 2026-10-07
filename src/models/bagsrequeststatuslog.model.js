"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // Status history for every BagsRequest: one row per transition (including creation).
  class BagsRequestStatusLog extends Model {
    static associate(models) {
      this.belongsTo(models.BagsRequest, { foreignKey: "bagsRequestId", as: "bagsRequest" });
      this.belongsTo(models.Employee, { foreignKey: "changedBy", as: "actor" });
    }
  }

  BagsRequestStatusLog.init(
    {
      bagsRequestId: DataTypes.INTEGER,
      fromStatus: DataTypes.STRING, // null for the creation row
      toStatus: { type: DataTypes.STRING, allowNull: false },
      changedBy: DataTypes.INTEGER,
      bagsCount: DataTypes.INTEGER, // bags involved in this step (dispatch qty, return/share qty), if any
      note: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "BagsRequestStatusLog",
    }
  );

  return BagsRequestStatusLog;
};

"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class BagsRequestStatusLog extends Model {
    static associate(models) {
      this.belongsTo(models.BagsRequest, { foreignKey: "bagsRequestId", as: "bagsRequest" });
      this.belongsTo(models.Employee, { foreignKey: "changedBy", as: "actor" });
    }
  }

  BagsRequestStatusLog.init(
    {
      bagsRequestId: DataTypes.INTEGER,
      fromStatus: DataTypes.STRING(20),
      toStatus: { type: DataTypes.STRING(20), allowNull: false },
      changedBy: DataTypes.INTEGER,
      note: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "BagsRequestStatusLog",
      tableName: "bags_request_status_logs",
    }
  );

  return BagsRequestStatusLog;
};
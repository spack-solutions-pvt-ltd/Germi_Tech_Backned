"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // Status history for every BagsTransfer: one row per transition (including creation).
  class BagsTransferStatusLog extends Model {
    static associate(models) {
      this.belongsTo(models.BagsTransfer, { foreignKey: "bagsTransferId", as: "bagsTransfer" });
      this.belongsTo(models.Employee, { foreignKey: "changedBy", as: "actor" });
    }
  }

  BagsTransferStatusLog.init(
    {
      bagsTransferId: DataTypes.INTEGER,
      fromStatus: DataTypes.STRING(20), // null for the creation row
      toStatus: { type: DataTypes.STRING(20), allowNull: false },
      changedBy: DataTypes.INTEGER,
      bagsCount: DataTypes.INTEGER,
      note: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "BagsTransferStatusLog",
    }
  );

  return BagsTransferStatusLog;
};

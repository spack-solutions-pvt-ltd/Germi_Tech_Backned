"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // One row per "Send bags" submission. A supervisor can send any number of
  // times, from any of their allotments, to a company (type 'return') or to
  // any other supervisor's allotment (type 'shared').
  //
  // Balances only move when the transfer is marked Received: the sender's
  // allotment is debited and (for 'shared') the receiver's allotment credited.
  // Not Received / Cancelled move nothing.
  class BagsTransfer extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "senderId", as: "sender" });
      this.belongsTo(models.Employee, { foreignKey: "createdBy", as: "creator" });
      this.belongsTo(models.AllotmentVillage, { foreignKey: "fromAllotmentVillageId", as: "fromAllotmentVillage" });
      this.belongsTo(models.SeedCompany, { foreignKey: "toCompanyId", as: "toCompany" });
      this.belongsTo(models.Employee, { foreignKey: "toSupervisorId", as: "toSupervisor" });
      this.belongsTo(models.AllotmentVillage, { foreignKey: "toAllotmentVillageId", as: "toAllotmentVillage" });
      this.belongsTo(models.Employee, { foreignKey: "receivedBy", as: "receiver" });
      this.belongsTo(models.Employee, { foreignKey: "cancelledBy", as: "canceller" });
      this.hasMany(models.BagsTransferStatusLog, {
        foreignKey: "bagsTransferId",
        as: "statusLogs",
        onDelete: "CASCADE",
      });
    }
  }

  BagsTransfer.init(
    {
      transferCode: { type: DataTypes.STRING(30), unique: true }, // e.g. BT-0001, set right after insert
      type: { type: DataTypes.ENUM("return", "shared"), allowNull: false }, // company -> return, supervisor -> shared
      senderId: { type: DataTypes.INTEGER, allowNull: false }, // the supervisor whose bags are sent
      createdBy: DataTypes.INTEGER, // who submitted it — differs when raised on the sender's behalf
      fromAllotmentVillageId: { type: DataTypes.INTEGER, allowNull: false }, // which allotment's bags are leaving

      // --- return (Send to: Company) ---
      // 'germitech' is the internal company (no SeedCompany row); 'seed_company' needs toCompanyId.
      toCompanyType: DataTypes.ENUM("germitech", "seed_company"),
      toCompanyId: DataTypes.INTEGER,

      // --- shared (Send to: Supervisor) ---
      toSupervisorId: DataTypes.INTEGER,
      toAllotmentVillageId: DataTypes.INTEGER, // the receiver's allotment the bags land in

      bags: { type: DataTypes.INTEGER, allowNull: false },
      note: DataTypes.TEXT,

      status: {
        type: DataTypes.ENUM("pending", "received", "not_received", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      receivedBy: DataTypes.INTEGER, // receiving supervisor (shared) or L1/L2 (return)
      receivedAt: DataTypes.DATE,
      cancelledBy: DataTypes.INTEGER,
      cancelledAt: DataTypes.DATE,
      cancellationReason: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "BagsTransfer",
    }
  );

  return BagsTransfer;
};

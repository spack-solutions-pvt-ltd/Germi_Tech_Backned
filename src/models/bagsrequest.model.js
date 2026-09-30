"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class BagsRequest extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "requestedBy", as: "requester" });
      this.belongsTo(models.Employee, { foreignKey: "createdBy", as: "creator" });
      this.belongsTo(models.Employee, { foreignKey: "cancelledBy", as: "canceller" });
      this.belongsTo(models.Employee, { foreignKey: "verifiedBy", as: "verifier" });
      this.belongsTo(models.Employee, { foreignKey: "approvedBy", as: "approver" });
      this.belongsTo(models.Employee, { foreignKey: "rejectedBy", as: "rejecter" });
      // Return/Shared only — nullable for type='request'.
      this.belongsTo(models.AllotmentVillage, { foreignKey: "allotmentVillageId", as: "allotmentVillage" });
      this.belongsTo(models.SeedCompany, { foreignKey: "destinationCompanyId", as: "destinationCompany" });
      this.belongsTo(models.Employee, { foreignKey: "destinationSupervisorId", as: "destinationSupervisor" });

    //   this.hasMany(models.BagsRequestCropEntry, {
    //     foreignKey: "bagsRequestId",
    //     as: "cropEntries",
    //     onDelete: "CASCADE",
    //   });
    //   this.hasMany(models.BagsRequestStatusLog, {
    //     foreignKey: "bagsRequestId",
    //     as: "statusLogs",
    //     onDelete: "CASCADE",
    //   });
    }
  }

  BagsRequest.init(
    {
      requestCode: { type: DataTypes.STRING(30), allowNull: false, unique: true }, // e.g. BG-1001

      // 'request'  -> the standard L3 "I need bags" flow (this turn's focus)
      // 'return'   -> supervisor sending bags back to a company (not yet built)
      // 'shared'   -> supervisor sending bags to another supervisor (not yet built)
      type: {
        type: DataTypes.ENUM("request", "return", "shared"),
        allowNull: false,
        defaultValue: "request",
      },

      requestedBy: DataTypes.INTEGER, // who the request is FOR (the supervisor)
      createdBy: DataTypes.INTEGER, // who actually submitted it — differs when L1/L2 create it on a supervisor's behalf

      // Status vocabulary differs by type:
      // type='request' uses: pending, in_process, bags_sent, received, not_received, cancelled
      // type='return'|'shared' uses: pending, verified/approved (return), approved/rejected (shared), rejected, cancelled
      // Kept as one enum since a row is only ever one type, but note which
      // values are meaningful for which type in application logic, not the DB.
      status: {
        type: DataTypes.ENUM(
          "pending",
          "in_process",
          "bags_sent",
          "received",
          "not_received",
          "verified",
          "approved",
          "rejected",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      // --- Return / Shared only (all nullable — unused for type='request') ---
      allotmentVillageId: DataTypes.INTEGER, // the single allotment bags are being sent FROM
      destinationKind: DataTypes.ENUM("company", "supervisor"),
      destinationCompanyId: DataTypes.INTEGER, // null + destinationKind='company' means the internal "Germi Tech Company"
      destinationSupervisorId: DataTypes.INTEGER, // for 'shared' — the receiving supervisor
      bagsSending: DataTypes.INTEGER,
      note: DataTypes.TEXT,

      cancelledBy: DataTypes.INTEGER,
      verifiedBy: DataTypes.INTEGER,
      verifiedAt: DataTypes.DATE,
      approvedBy: DataTypes.INTEGER,
      approvedAt: DataTypes.DATE,
      rejectedBy: DataTypes.INTEGER,
      rejectedStage: DataTypes.ENUM("verification", "approval"),
      rejectionReason: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "BagsRequest",
    }
  );

  return BagsRequest;
};
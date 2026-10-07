"use strict";
const { Model } = require("sequelize");
const { fileUrlAttribute } = require("../utils/fileUrlAttribute");

module.exports = (sequelize, DataTypes) => {
  // Loading done at a village for a warehouse dispatch, raised by L3.
  // L2 verifies (and fills amounts), L1 approves by creating the Transport
  // and/or Hamali payment — each one independently. transportPaymentId /
  // hamaliPaymentId record which payments already exist so neither can be
  // created twice.
  class LoadingRequest extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "requestedBy", as: "requester" });
      this.belongsTo(models.Employee, { foreignKey: "createdBy", as: "creator" });
      this.belongsTo(models.Employee, { foreignKey: "verifiedBy", as: "verifier" });
      this.belongsTo(models.Employee, { foreignKey: "approvedBy", as: "approver" });
      this.belongsTo(models.Employee, { foreignKey: "cancelledBy", as: "canceller" });
      this.belongsTo(models.Village, { foreignKey: "fromVillageId", as: "fromVillage" });
      this.belongsTo(models.Warehouse, { foreignKey: "toWarehouseId", as: "toWarehouse" });
      this.belongsTo(models.LogisticsPartner, { foreignKey: "logisticsPartnerId", as: "logisticsPartner" });
      this.belongsTo(models.Payment, { foreignKey: "transportPaymentId", as: "transportPayment" });
      this.belongsTo(models.Payment, { foreignKey: "hamaliPaymentId", as: "hamaliPayment" });
      this.hasMany(models.LoadingRequestEntry, {
        foreignKey: "loadingRequestId",
        as: "cropEntries",
        onDelete: "CASCADE",
      });
    }
  }

  LoadingRequest.init(
    {
      requestCode: DataTypes.STRING(30), // e.g. LD-0001
      requestedBy: DataTypes.INTEGER, // the supervisor (L3) the request belongs to
      createdBy: DataTypes.INTEGER, // who actually submitted it
      fromVillageId: DataTypes.INTEGER,
      toWarehouseId: DataTypes.INTEGER,
      startPhotoUrl: fileUrlAttribute(DataTypes, "startPhotoUrl"), // S3 key (or legacy /uploads path); reads return the viewable URL
      startPhotoName: DataTypes.STRING(255), // original file name
      endPhotoUrl: fileUrlAttribute(DataTypes, "endPhotoUrl"),
      endPhotoName: DataTypes.STRING(255), // original file name
      transporterName: DataTypes.STRING, // free text typed by L3
      hamaliGangName: DataTypes.STRING, // free text typed by L3 — the Hamali payment recipient
      note: DataTypes.STRING,

      // --- Amounts (entered by L2 at verification, editable by L1) ---
      logisticsPartnerId: DataTypes.INTEGER, // "Transport name" — the Transport payment recipient
      rate: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, // per DK unit
      marketsAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      kanttaBill: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      hamaliAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      // partially_approved = one of the two payments created. L3 never sees
      // it as a separate status (shown as "approved" to them).
      status: {
        type: DataTypes.ENUM("pending", "verified", "partially_approved", "approved", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      transportPaymentId: DataTypes.INTEGER,
      hamaliPaymentId: DataTypes.INTEGER,

      verifiedBy: DataTypes.INTEGER,
      verifiedAt: DataTypes.DATE,
      approvedBy: DataTypes.INTEGER, // L1 who created the (first) payment
      approvedAt: DataTypes.DATE,
      cancelledBy: DataTypes.INTEGER,
      cancelledAt: DataTypes.DATE,
      cancellationReason: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "LoadingRequest",
    }
  );

  return LoadingRequest;
};

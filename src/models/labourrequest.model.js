"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // Header for a labour work-order raised by a supervisor. Each crop entry
  // (see LabourRequestCropEntry) is tied to one of the supervisor's own
  // AllotmentVillage assignments.
  class LabourRequest extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "requestedBy", as: "requester" });
      this.belongsTo(models.Employee, { foreignKey: "createdBy", as: "creator" });
      this.belongsTo(models.Employee, { foreignKey: "verifiedBy", as: "verifier" });
      this.belongsTo(models.Employee, { foreignKey: "approvedBy", as: "approver" });
      this.belongsTo(models.Employee, { foreignKey: "rejectedBy", as: "rejecter" });
      this.belongsTo(models.LaborGroup, { foreignKey: "laborGroupId", as: "laborGroup" });
      this.hasMany(models.LabourRequestCropEntry, {
        foreignKey: "labourRequestId",
        as: "cropEntries",
        onDelete: "CASCADE",
      });
    }
  }

  LabourRequest.init(
    {
      requestCode: DataTypes.STRING(30),
      requestedBy: DataTypes.INTEGER, // who the request is FOR (the supervisor)
      createdBy: DataTypes.INTEGER, // who actually submitted it — usually same as requestedBy, differs when L1/L2 create it on a supervisor's behalf
      laborGroupId: DataTypes.INTEGER, // nullable — see otherLaborGroupName
      otherLaborGroupName: DataTypes.STRING(150), // used when "Others" is picked instead of a real LaborGroup
      fromLocation: DataTypes.STRING(255),
      toLocation: DataTypes.STRING(255),
      startPhotoUrl: DataTypes.STRING(500),
      endPhotoUrl: DataTypes.STRING(500),
      transportType: DataTypes.ENUM("full_day", "half_day", "up_and_down"),
      notes: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM("pending", "verified", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      verifiedBy: DataTypes.INTEGER,
      approvedBy: DataTypes.INTEGER,
      verifiedAt: DataTypes.DATE,
      approvedAt: DataTypes.DATE,
      rejectedBy: DataTypes.INTEGER,
      rejectedStage: DataTypes.ENUM("verification", "approval"), // which stage the rejection happened at
      rejectionReason: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "LabourRequest",
    }
  );

  return LabourRequest;
};
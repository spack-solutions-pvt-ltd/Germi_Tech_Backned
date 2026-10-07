"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // A supervisor's "I need bags" request (Requests → Add Request). L2
  // dispatches, the supervisor confirms receipt. Does NOT go through the
  // Approval page. Bags a supervisor sends back to a company or to another
  // supervisor live in BagsTransfer, not here.
  class BagsRequest extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "requestedBy", as: "requester" });
      this.belongsTo(models.Employee, { foreignKey: "createdBy", as: "creator" });
      this.belongsTo(models.Employee, { foreignKey: "cancelledBy", as: "canceller" });
      this.hasMany(models.BagsRequestCropEntry, {
        foreignKey: "bagsRequestId",
        as: "cropEntries",
        onDelete: "CASCADE",
      });
      this.hasMany(models.BagsRequestStatusLog, {
        foreignKey: "bagsRequestId",
        as: "statusLogs",
        onDelete: "CASCADE",
      });
    }
  }

  BagsRequest.init(
    {
      requestCode: { type: DataTypes.STRING, unique: true }, // e.g. BR-0001, set right after insert
      requestedBy: DataTypes.INTEGER, // the supervisor the bags are for
      createdBy: DataTypes.INTEGER, // who actually submitted it — differs when L1/L2 create it on a supervisor's behalf
      status: {
        type: DataTypes.ENUM(
          "pending",
          "in_process",
          "bags_sent",
          "received",
          "not_received",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      note: DataTypes.STRING,
      cancelledBy: DataTypes.INTEGER,
      cancelledAt: DataTypes.DATE,
      cancellationReason: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "BagsRequest",
    }
  );

  return BagsRequest;
};

"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ExpenseRequest extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "requestedBy",
        as: "requester",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "createdBy",
        as: "creator",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "verifiedBy",
        as: "verifier",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "approvedBy",
        as: "approver",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "rejectedBy",
        as: "rejecter",
      });
    }
  }

  ExpenseRequest.init(
    {
      requestCode: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      }, // e.g. EX-1001
      requestedBy: DataTypes.INTEGER, // who the request is FOR (the supervisor)
      createdBy: DataTypes.INTEGER, // who actually submitted it — usually same as requestedBy, differs when L1/L2 create it on a supervisor's behalf
      purpose: { type: DataTypes.STRING(255), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      billUrl: DataTypes.STRING(500),
      note: DataTypes.TEXT,
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
      rejectedStage: DataTypes.ENUM("verification", "approval"),
      rejectionReason: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "ExpenseRequest",
    },
  );

  return ExpenseRequest;
};

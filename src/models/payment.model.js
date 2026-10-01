"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // One normalized payment list fed by multiple sources (expense / labour /
  // loading requests, employee insurance). sourceRequestType +
  // sourceRequestId + recipientType (+ periodKey) identify exactly which
  // source produced this row, so the same source can't create a duplicate
  // payment (see the unique index below) — Loading is the one source that
  // legitimately spawns TWO payments (transport + hamali), which is why
  // recipientType is part of the key.
  //
  // Lifecycle: created as pending (createdBy + createdAt) -> while pending
  // the processing details (paymentMode, referenceId, paymentDate, remark)
  // can be saved -> processed (processedBy + processedAt).
  class Payment extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "createdBy",
        as: "creator",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "processedBy",
        as: "processor",
      });
    }
  }

  Payment.init(
    {
      paymentCode: DataTypes.STRING(30),
      type: {
        type: DataTypes.ENUM(
          "supervisor",
          "labour",
          "transport",
          "hamali",
          "insurance",
          "expense",
        ),
        allowNull: false,
      },
      sourceRequestType: {
        type: DataTypes.ENUM(
          "labour_request",
          "expense_request",
          "loading_request",
          "employee_insurance",
        ),
        allowNull: false,
      },
      sourceRequestId: { type: DataTypes.INTEGER, allowNull: false },
      periodKey: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "" },
      recipientType: {
        type: DataTypes.ENUM(
          "supervisor",
          "employee",
          "labor_group",
          "logistics_partner",
          "hamali_group",
        ),
        allowNull: false,
      },
      recipientId: DataTypes.INTEGER,
      recipientName: DataTypes.STRING(150), // snapshot name, used when there's no recipientId to join on (e.g. hamali gang)
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      createdBy: DataTypes.INTEGER, // who created it (approver of the source request); null when system-created (insurance)
      status: {
        type: DataTypes.ENUM("pending", "processed"),
        allowNull: false,
        defaultValue: "pending",
      },
      // Processing details — editable while pending.
      paymentMode: DataTypes.ENUM("bank", "upi", "cash"),
      referenceId: DataTypes.STRING(100),
      paymentDate: DataTypes.DATEONLY,
      remark: DataTypes.TEXT,
      processedBy: DataTypes.INTEGER, // who marked it processed
      processedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Payment",
      indexes: [
        {
          name: "payments_source_unique",
          unique: true,
          fields: ["sourceRequestType", "sourceRequestId", "recipientType", "periodKey"],
        },
      ],
    },
  );  

  return Payment;
};

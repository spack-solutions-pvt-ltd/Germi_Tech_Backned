"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // One normalized payment list fed by multiple sources (expense/labour/
  // loading requests today; insurance later). sourceRequestType +
  // sourceRequestId + recipientType together identify exactly which
  // approval produced this row, so re-approving the same request can't
  // create a duplicate payment (see the unique index below) — Loading is
  // the one type that can legitimately spawn TWO payments (transport +
  // hamali) from the same request, which is why recipientType is part of
  // the uniqueness key, not just the source.
  class Payment extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "requestedBy", as: "requester" });
      this.belongsTo(models.Employee, { foreignKey: "verifiedBy", as: "verifier" });
      this.belongsTo(models.Employee, { foreignKey: "approvedBy", as: "approver" });
      this.belongsTo(models.Employee, { foreignKey: "processedBy", as: "processor" });
    }
  }

  Payment.init(
    {
      paymentCode: { type: DataTypes.STRING(30), allowNull: false, unique: true }, // e.g. PY-1101
      type: {
        type: DataTypes.ENUM("labour", "expense", "transport", "hamali", "insurance"),
        allowNull: false,
      },
      sourceRequestType: {
        type: DataTypes.ENUM("labour_request", "expense_request", "loading_request"),
        allowNull: false,
      },
      sourceRequestId: { type: DataTypes.INTEGER, allowNull: false },
      recipientType: {
        type: DataTypes.ENUM("employee", "labor_group", "logistics_partner", "hamali_group"),
        allowNull: false,
      },
      recipientId: DataTypes.INTEGER,
      recipientName: DataTypes.STRING(150), // snapshot name, used when there's no recipientId to join on (e.g. hamali gang)
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      requestedBy: DataTypes.INTEGER,
      verifiedBy: DataTypes.INTEGER,
      approvedBy: DataTypes.INTEGER,
      processedBy: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM("pending", "processed"),
        allowNull: false,
        defaultValue: "pending",
      },
      paymentMode: DataTypes.ENUM("bank", "upi", "cash"),
      accountHolderName: DataTypes.STRING(150),
      accountNumber: DataTypes.STRING(50),
      ifscCode: DataTypes.STRING(20),
      bankName: DataTypes.STRING(150),
      upiId: DataTypes.STRING(100),
      referenceId: DataTypes.STRING(100),
      paymentDate: DataTypes.DATEONLY,
      remark: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Payment",
      indexes: [
        { unique: true, fields: ["sourceRequestType", "sourceRequestId", "recipientType"] },
      ],
    }
  );

  return Payment;
};
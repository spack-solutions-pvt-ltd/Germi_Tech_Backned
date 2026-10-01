"use strict";
const { Payment } = require("../models");
const { generateId } = require("./generateIds");
const { PAYMENT_TYPES } = require("../constants/payments");

/**
 * Creates a Payment row for an approved request — a no-op if one already
 * exists for this exact (sourceRequestType, sourceRequestId, recipientType,
 * periodKey) combination, so re-approving (or a double-click) can't create
 * duplicates. periodKey is only needed for recurring sources (insurance).
 * Pass `transaction` to make the payment part of the caller's transaction.
 */
const createPaymentIfNeeded = async (
  {
    type,
    sourceRequestType,
    sourceRequestId,
    recipientType,
    periodKey = "",
    recipientId = null,
    recipientName = null,
    amount,
    createdBy = null, // who created the payment; null when system-created
  },
  { transaction } = {},
) => {
  const existing = await Payment.findOne({
    where: {
      sourceRequestType,
      sourceRequestId,
      recipientType,
      periodKey,
    },
    transaction,
  });

  if (existing) return existing;

  // Create payment first to get the auto-generated ID
  const payment = await Payment.create(
    {
      type,
      sourceRequestType,
      sourceRequestId,
      recipientType,
      periodKey,
      recipientId,
      recipientName,
      amount,
      createdBy,
      status: "pending",
    },
    { transaction },
  );

  // Generate payment code using the newly created payment ID, e.g. PY-SU-0001
  const prefix = PAYMENT_TYPES[type]?.codePrefix || "PY";
  await payment.update(
    { paymentCode: generateId(prefix, payment.id) },
    { transaction },
  );

  return payment;
};

module.exports = { createPaymentIfNeeded };

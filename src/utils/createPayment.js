"use strict";
const { Payment } = require("../models");
const { generateId } = require("./generateIds");

/**
 * Creates a Payment row for an approved request — a no-op if one already
 * exists for this exact (sourceRequestType, sourceRequestId, recipientType)
 * combination, so re-approving (or a double-click) can't create duplicates.
 */
const createPaymentIfNeeded = async ({
  type,
  sourceRequestType,
  sourceRequestId,
  recipientType,
  recipientId = null,
  recipientName = null,
  amount,
  requestedBy,
  verifiedBy,
  approvedBy,
}) => {
  const existing = await Payment.findOne({
    where: {
      sourceRequestType,
      sourceRequestId,
      recipientType,
    },
  });

  if (existing) return existing;

  // Create payment first to get the auto-generated ID
  const payment = await Payment.create({
    type,
    sourceRequestType,
    sourceRequestId,
    recipientType,
    recipientId,
    recipientName,
    amount,
    requestedBy,
    verifiedBy,
    approvedBy,
    status: "pending",
  });

  // Generate payment code using the newly created payment ID
  const paymentCode = await generateId("PY", payment.id);

  // Update payment with generated code
  await payment.update({
    paymentCode,
  });

  return payment;
};

module.exports = { createPaymentIfNeeded };

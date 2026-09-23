"use strict";
const { Payment } = require("../models");
const { generateId } = require("./generateIds");

/**
 * Creates a Payment row for an approved request — a no-op if one already
 * exists for this exact (sourceRequestType, sourceRequestId, recipientType)
 * combination, so re-approving (or a double-click) can't create duplicates.
 */
async function createPaymentIfNeeded({
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
}) {
  const existing = await Payment.findOne({
    where: { sourceRequestType, sourceRequestId, recipientType },
  });
  if (existing) return existing;

  const paymentCode = await generateId(Payment, "PY");

  return Payment.create({
    paymentCode,
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
}

module.exports = { createPaymentIfNeeded };
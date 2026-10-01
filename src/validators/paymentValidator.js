"use strict";
const { z } = require("zod");

// Processing details a pending payment carries. All optional when saving —
// completeness is only enforced when the payment is processed.
const paymentDetailsSchema = z.object({
  paymentMode: z.enum(["bank", "upi", "cash"], 'paymentMode must be "bank", "upi" or "cash"').optional(),
  referenceId: z.string().trim().max(100).nullable().optional(),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paymentDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  remark: z.string().trim().max(1000).nullable().optional(),
});

/** Validates the editable details. Returns { data } (only the keys sent) or { message }. */
function validatePaymentDetails(body) {
  const result = paymentDetailsSchema.safeParse(body || {});
  if (!result.success) return { message: result.error.issues[0].message };
  const data = Object.fromEntries(Object.entries(result.data).filter(([, v]) => v !== undefined));
  return { data };
}

/**
 * Checks a payment's final details before it is processed. Returns an error
 * message, or null when it is ready. Reference ID is required for bank/UPI.
 */
function missingProcessDetails({ paymentMode, referenceId, paymentDate }) {
  if (!paymentMode) return "Select a payment mode before processing";
  if (!paymentDate) return "Payment date is required before processing";
  if (paymentMode !== "cash" && !referenceId) return "Reference ID is required for bank and UPI payments";
  return null;
}

module.exports = { validatePaymentDetails, missingProcessDetails };

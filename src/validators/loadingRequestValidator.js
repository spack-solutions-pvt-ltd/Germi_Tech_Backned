"use strict";
const { z } = require("zod");

// Amount fields L2/L1 can set on a loading request. All optional — only
// what's sent gets changed. Multipart/JSON both arrive as strings, hence coerce.
const money = (label) => z.coerce.number(`${label} must be a number`).min(0, `${label} must be ≥ 0`);

const amountsSchema = z.object({
  logisticsPartnerId: z.coerce.number().int().positive().nullable().optional(),
  rate: money("rate").optional(),
  marketsAmount: money("marketsAmount").optional(),
  kanttaBill: money("kanttaBill").optional(),
  hamaliAmount: money("hamaliAmount").optional(),
});

const createPaymentsSchema = amountsSchema.extend({
  paymentTypes: z
    .array(z.enum(["transport", "hamali"], 'paymentTypes can only contain "transport" and "hamali"'))
    .min(1, "Select at least one payment to create"),
});

function validate(schema, body) {
  const result = schema.safeParse(body || {});
  if (result.success) return { data: result.data };
  return { message: result.error.issues[0].message };
}

/** Only the amount keys actually present in the body. */
const pickAmounts = (data) =>
  Object.fromEntries(
    Object.entries(data).filter(([key, value]) => key in amountsSchema.shape && value !== undefined),
  );

module.exports = {
  validateAmounts: (body) => validate(amountsSchema, body),
  validateCreatePayments: (body) => validate(createPaymentsSchema, body),
  pickAmounts,
};

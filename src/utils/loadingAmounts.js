"use strict";

// Single source of truth for loading-request money and approval state.
//
//   transportAmount = rate × total DK quantity + markets + kantta bill
//   hamaliAmount    = hamali amount
//   totalAmount     = transportAmount + hamaliAmount

const round2 = (n) => Math.round(n * 100) / 100;

function calculateLoadingAmounts(request, entries) {
  const totalBags = entries.reduce((a, e) => a + (Number(e.noOfBags) || 0), 0);
  const totalDkQuantity = round2(entries.reduce((a, e) => a + (Number(e.dkQuantity) || 0), 0));
  const rate = Number(request.rate) || 0;
  const marketsAmount = Number(request.marketsAmount) || 0;
  const kanttaBill = Number(request.kanttaBill) || 0;
  const hamaliAmount = Number(request.hamaliAmount) || 0;

  const transportAmount = round2(rate * totalDkQuantity + marketsAmount + kanttaBill);
  return {
    totalBags,
    totalDkQuantity,
    rate,
    marketsAmount,
    kanttaBill,
    transportAmount,
    hamaliAmount,
    totalAmount: round2(transportAmount + hamaliAmount),
  };
}

/**
 * Which payments this request needs: a payment is required when it has an
 * amount, or when it was already created (it can't become un-required).
 */
function requiredPaymentTypes(request, amounts) {
  const required = [];
  if (amounts.transportAmount > 0 || request.transportPaymentId) required.push("transport");
  if (amounts.hamaliAmount > 0 || request.hamaliPaymentId) required.push("hamali");
  return required;
}

const PAYMENT_ID_FIELD = { transport: "transportPaymentId", hamali: "hamaliPaymentId" };

/** partially_approved until every required payment exists, then approved. */
function approvalStatus(request, amounts) {
  const required = requiredPaymentTypes(request, amounts);
  const created = required.filter((type) => request[PAYMENT_ID_FIELD[type]]);
  if (!created.length) return null; // no payment yet — not an approval state
  return created.length === required.length ? "approved" : "partially_approved";
}

module.exports = {
  calculateLoadingAmounts,
  requiredPaymentTypes,
  approvalStatus,
  PAYMENT_ID_FIELD,
};

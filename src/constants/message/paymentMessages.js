"use strict";

// Response messages for controller/paymentController.js.
// Functions build messages that include values (counts, codes, statuses).
const paymentMessages = {
  unknownPaymentTypeUse: (unknown, SELECTABLE_TYPES) => `Unknown payment type: ${unknown}. Use: ${SELECTABLE_TYPES}`,
  mustBeYyyyMmDd: (name) => `${name} must be YYYY-MM-DD`,
  paymentNotFound: "Payment not found",
  thisPaymentHasAlreadyBeenProcessed: "This payment has already been processed",
  statusMustBeOneOf: (PAYMENT_STATUSES) => `status must be one of: ${PAYMENT_STATUSES}`,
  paymentsFetchedSuccessfully: "Payments fetched successfully",
  paymentSummaryFetchedSuccessfully: "Payment summary fetched successfully",
  paymentFilterOptionsFetchedSuccessfully: "Payment filter options fetched successfully",
  paymentFetchedSuccessfully: "Payment fetched successfully",
  paymentDetailsSaved: "Payment details saved",
  paymentProcessedSuccessfully: "Payment processed successfully",
};

module.exports = { paymentMessages };

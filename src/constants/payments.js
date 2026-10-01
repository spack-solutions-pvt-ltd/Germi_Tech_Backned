"use strict";

// One entry per Payment.type: UI label + paymentCode prefix (PY-SU-0001, ...).
const PAYMENT_TYPES = {
  supervisor: { label: "Supervisor", codePrefix: "PY-SU" },
  labour: { label: "Labour", codePrefix: "PY-LB" },
  transport: { label: "Transport", codePrefix: "PY-TR" },
  hamali: { label: "Hamali", codePrefix: "PY-HM" },
  insurance: { label: "Insurance", codePrefix: "PY-IN" },
  expense: { label: "Supervisor", codePrefix: "PY-SU" }, // legacy name of "supervisor"
};

const PAYMENT_STATUSES = ["pending", "processed"];
const PAYMENT_MODES = ["bank", "upi", "cash"];

// Levels that can open the Payments page / process a payment.
const PAYMENT_VIEW_LEVELS = ["L1", "L2"];
const PAYMENT_PROCESS_LEVELS = ["L2"];

/** Types that should be treated as the same bucket when filtering ("supervisor" also matches legacy "expense"). */
const typeFilterValues = (type) => (type === "supervisor" ? ["supervisor", "expense"] : [type]);

module.exports = {
  PAYMENT_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_MODES,
  PAYMENT_VIEW_LEVELS,
  PAYMENT_PROCESS_LEVELS,
  typeFilterValues,
};

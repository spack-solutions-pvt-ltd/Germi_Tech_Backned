"use strict";
const { createDueInsurancePayments } = require("../utils/insurancePayments");

const RUN_EVERY_MS = 12 * 60 * 60 * 1000; // twice a day — safe to repeat, payments are de-duplicated

async function run() {
  try {
    const { checked } = await createDueInsurancePayments();
    console.log(`Insurance payment job: checked ${checked} policies due within 10 days`);
  } catch (err) {
    console.error("Insurance payment job failed:", err);
  }
}

/** Runs once on startup, then on an interval. */
function startInsurancePaymentJob() {
  run();
  setInterval(run, RUN_EVERY_MS);
}

module.exports = { startInsurancePaymentJob };

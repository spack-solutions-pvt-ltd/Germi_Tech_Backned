"use strict";
const { Op } = require("sequelize");
const { EmployeeInsurance } = require("../models");
const { createPaymentIfNeeded } = require("./createPayment");

const DAYS_BEFORE_EXPIRY = 10;

/** YYYY-MM-DD in server local time (EmployeeInsurance.expiryDate is DATEONLY). */
function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dueWindow(today = new Date()) {
  const until = new Date(today);
  until.setDate(until.getDate() + DAYS_BEFORE_EXPIRY);
  return { from: toDateOnly(today), to: toDateOnly(until) };
}

/**
 * Creates the insurance payment for one policy if it expires within the
 * next DAYS_BEFORE_EXPIRY days. One payment per (insurance, expiryDate):
 * if it already exists nothing is created; a renewed policy (new
 * expiryDate) gets its own payment. Returns the payment or null.
 */
async function createInsurancePaymentIfDue(insurance) {
  if (!insurance.expiryDate || !(Number(insurance.amount) > 0)) return null;

  const { from, to } = dueWindow();
  if (insurance.expiryDate < from || insurance.expiryDate > to) return null;

  return createPaymentIfNeeded({
    type: "insurance",
    sourceRequestType: "employee_insurance",
    sourceRequestId: insurance.id,
    periodKey: insurance.expiryDate,
    recipientType: "employee",
    recipientId: insurance.employeeId,
    amount: insurance.amount,
  });
}

/** Checks every policy expiring in the next DAYS_BEFORE_EXPIRY days. */
async function createDueInsurancePayments() {
  const { from, to } = dueWindow();
  const insurances = await EmployeeInsurance.findAll({
    where: {
      expiryDate: { [Op.between]: [from, to] },
      amount: { [Op.gt]: 0 },
    },
  });

  for (const insurance of insurances) {
    try {
      await createInsurancePaymentIfDue(insurance);
    } catch (err) {
      console.error(`Insurance payment failed for insurance ${insurance.id}:`, err);
    }
  }
  return { checked: insurances.length };
}

module.exports = { createInsurancePaymentIfDue, createDueInsurancePayments, DAYS_BEFORE_EXPIRY };

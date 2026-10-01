"use strict";
const { Op } = require("sequelize");
const {
  Employee,
  LaborGroup,
  LogisticsPartner,
  ExpenseRequest,
  LabourRequest,
  LoadingRequest,
  EmployeeInsurance,
} = require("../models");
const { PAYMENT_TYPES } = require("../constants/payments");
const { generateId } = require("./generateIds");

// Payment rows only store ids (recipientType + recipientId, sourceRequestType
// + sourceRequestId). This file turns a page of payments into what the UI
// shows — recipient name and source code (EX-0003) — using one query per
// related table instead of one per row.

const EMPLOYEE_RECIPIENTS = ["supervisor", "employee"];

const idsOf = (payments, predicate, key) => [
  ...new Set(payments.filter(predicate).map((p) => p[key]).filter(Boolean)),
];

const byId = (rows) => new Map(rows.map((r) => [r.id, r]));

async function loadRelated(payments) {
  const recipientIds = (types) =>
    idsOf(payments, (p) => [].concat(types).includes(p.recipientType), "recipientId");
  const sourceIds = (type) => idsOf(payments, (p) => p.sourceRequestType === type, "sourceRequestId");

  const findAll = (model, ids, attributes) =>
    ids.length ? model.findAll({ where: { id: ids }, attributes }) : [];

  const [employees, laborGroups, partners, expenses, labours, insurances, loadings] = await Promise.all([
    findAll(Employee, recipientIds(EMPLOYEE_RECIPIENTS), ["id", "empId", "name", "level"]),
    findAll(LaborGroup, recipientIds("labor_group"), ["id", "laborGroupId", "name"]),
    findAll(LogisticsPartner, recipientIds("logistics_partner"), ["id", "logisticsId", "name"]),
    findAll(ExpenseRequest, sourceIds("expense_request"), ["id", "requestCode"]),
    findAll(LabourRequest, sourceIds("labour_request"), ["id", "requestCode"]),
    findAll(EmployeeInsurance, sourceIds("employee_insurance"), ["id", "provider"]),
    findAll(LoadingRequest, sourceIds("loading_request"), ["id", "requestCode"]),
  ]);

  return {
    employees: byId(employees),
    laborGroups: byId(laborGroups),
    partners: byId(partners),
    expenses: byId(expenses),
    labours: byId(labours),
    insurances: byId(insurances),
    loadings: byId(loadings),
  };
}

/** { type, id, name, detail } for the "To" column. */
function resolveRecipient(payment, related) {
  const { recipientType: type, recipientId: id, recipientName } = payment;

  if (EMPLOYEE_RECIPIENTS.includes(type)) {
    const emp = related.employees.get(id);
    const insurance =
      payment.sourceRequestType === "employee_insurance"
        ? related.insurances.get(payment.sourceRequestId)
        : null;
    // Insurance shows the provider ("Arjun Shetty · Star Health"), others the level.
    return { type, id, name: emp?.name || recipientName, detail: insurance?.provider || emp?.level || null };
  }
  if (type === "labor_group") {
    const group = related.laborGroups.get(id);
    return { type, id, name: group?.name || recipientName, detail: group?.laborGroupId || null };
  }
  if (type === "logistics_partner") {
    const partner = related.partners.get(id);
    return { type, id, name: partner?.name || recipientName, detail: partner?.logisticsId || null };
  }
  // hamali_group (and anything without a joinable id) — the snapshot name is all there is.
  return { type, id, name: recipientName, detail: null };
}

/** { type, id, code } — the request the payment came from (EX-0003, LR-0004, INS-0001). */
function resolveSource(payment, related) {
  const { sourceRequestType: type, sourceRequestId: id } = payment;
  const code = {
    expense_request: () => related.expenses.get(id)?.requestCode,
    labour_request: () => related.labours.get(id)?.requestCode,
    employee_insurance: () => generateId("INS", id),
    loading_request: () => related.loadings.get(id)?.requestCode,
  }[type]?.();
  return { type, id, code: code || null };
}

/**
 * Turns Payment instances (loaded with creator/processor) into plain
 * objects with typeLabel, recipient and source.
 */
async function attachPaymentContext(payments) {
  const related = await loadRelated(payments);
  return payments.map((payment) => {
    const json = payment.toJSON();
    return {
      ...json,
      type: json.type === "expense" ? "supervisor" : json.type, // legacy rows read as supervisor
      typeLabel: PAYMENT_TYPES[json.type]?.label || json.type,
      recipient: resolveRecipient(payment, related),
      source: resolveSource(payment, related),
    };
  });
}

/**
 * Search across payment code, reference id, recipient names, the source
 * request code and who created / processed it. Returns a `where` fragment.
 */
async function buildPaymentSearch(search) {
  const like = { [Op.like]: `%${search}%` };
  const ids = (rows) => rows.map((r) => r.id);

  const [employees, laborGroups, partners, expenses, labours, loadings] = await Promise.all([
    Employee.findAll({ where: { [Op.or]: [{ name: like }, { empId: like }] }, attributes: ["id"] }),
    LaborGroup.findAll({ where: { [Op.or]: [{ name: like }, { laborGroupId: like }] }, attributes: ["id"] }),
    LogisticsPartner.findAll({ where: { [Op.or]: [{ name: like }, { logisticsId: like }] }, attributes: ["id"] }),
    ExpenseRequest.findAll({ where: { requestCode: like }, attributes: ["id"] }),
    LabourRequest.findAll({ where: { requestCode: like }, attributes: ["id"] }),
    LoadingRequest.findAll({ where: { requestCode: like }, attributes: ["id"] }),
  ]);
  const employeeIds = ids(employees);

  return {
    [Op.or]: [
      { paymentCode: like },
      { referenceId: like },
      { recipientName: like },
      { recipientType: EMPLOYEE_RECIPIENTS, recipientId: employeeIds },
      { recipientType: "labor_group", recipientId: ids(laborGroups) },
      { recipientType: "logistics_partner", recipientId: ids(partners) },
      { sourceRequestType: "expense_request", sourceRequestId: ids(expenses) },
      { sourceRequestType: "labour_request", sourceRequestId: ids(labours) },
      { sourceRequestType: "loading_request", sourceRequestId: ids(loadings) },
      { createdBy: employeeIds },
      { processedBy: employeeIds },
    ],
  };
}

module.exports = { attachPaymentContext, buildPaymentSearch };

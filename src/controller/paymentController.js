"use strict";
const { Op, fn, col } = require("sequelize");
const { sequelize, Payment, Employee, ExpenseRequest } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error, httpError } = require("../utils/response");
const {
  attachPaymentContext,
  buildPaymentSearch,
} = require("../utils/paymentContext");
const {
  validatePaymentDetails,
  missingProcessDetails,
} = require("../validators/paymentValidator");
const {
  PAYMENT_TYPES,
  PAYMENT_STATUSES,
  typeFilterValues,
} = require("../constants/payments");

// Types offered in the filter ("expense" is only the legacy name of "supervisor").
const SELECTABLE_TYPES = Object.keys(PAYMENT_TYPES).filter((t) => t !== "expense");

const EMP_ATTRS = ["id", "empId", "name", "level"];

const PAYMENT_INCLUDES = [
  { model: Employee, as: "creator", attributes: EMP_ATTRS },
  { model: Employee, as: "processor", attributes: EMP_ATTRS },
];

/** [start, end] of a YYYY-MM-DD day in server local time. */
function dayRange(date) {
  return [new Date(`${date}T00:00:00`), new Date(`${date}T23:59:59.999`)];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "labour,transport" -> ["labour", "transport"] (+ legacy "expense" for supervisor). Throws on unknown types. */
function parseTypes(type) {
  const types = String(type).split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const unknown = types.filter((t) => !PAYMENT_TYPES[t]);
  if (unknown.length) {
    throw httpError(400, `Unknown payment type: ${unknown.join(", ")}. Use: ${SELECTABLE_TYPES.join(", ")}`);
  }
  return [...new Set(types.flatMap(typeFilterValues))];
}

/** Types whose value or label matches the search text ("lab" -> labour, "hamali" -> hamali). */
function typesMatching(text) {
  const term = text.toLowerCase();
  return Object.entries(PAYMENT_TYPES)
    .filter(([value, { label }]) => value.includes(term) || label.toLowerCase().includes(term))
    .map(([value]) => value);
}

function assertDate(name, value) {
  if (value && !DATE_ONLY.test(value)) throw httpError(400, `${name} must be YYYY-MM-DD`);
}

/**
 * Builds the list `where` from query params:
 *   status          pending | processed
 *   type            one or more, comma separated: supervisor,labour,transport,hamali,insurance
 *   createdBy       employee id
 *   processedBy     employee id
 *   paymentDate     exact payment date (YYYY-MM-DD)
 *   paymentDateFrom / paymentDateTo   payment date range (inclusive)
 *   date            created day on Pending, payment date on Processed (kept for the existing UI)
 *   code            payment code only, partial match (e.g. "PY-LB" or "0012")
 *   search          payment code, reference ID, recipient, source request code,
 *                   creator / processor names, and type labels ("labour", "hamali")
 */
async function buildListWhere(query) {
  const {
    status, type, createdBy, processedBy, date, search, code,
    paymentDate, paymentDateFrom, paymentDateTo,
  } = query;
  assertDate("date", date);
  assertDate("paymentDate", paymentDate);
  assertDate("paymentDateFrom", paymentDateFrom);
  assertDate("paymentDateTo", paymentDateTo);

  const and = [];
  if (status) and.push({ status });
  if (type) and.push({ type: parseTypes(type) });
  if (createdBy) and.push({ createdBy });
  if (processedBy) and.push({ processedBy });

  if (paymentDate) and.push({ paymentDate });
  if (paymentDateFrom || paymentDateTo) {
    and.push({
      paymentDate: {
        ...(paymentDateFrom && { [Op.gte]: paymentDateFrom }),
        ...(paymentDateTo && { [Op.lte]: paymentDateTo }),
      },
    });
  }
  if (date) {
    and.push(
      status === "processed"
        ? { paymentDate: date }
        : { createdAt: { [Op.between]: dayRange(date) } },
    );
  }

  if (code) and.push({ paymentCode: { [Op.like]: `%${code.trim()}%` } });

  if (search) {
    const term = search.trim();
    const searchWhere = await buildPaymentSearch(term);
    const matchingTypes = typesMatching(term);
    and.push(
      matchingTypes.length
        ? { [Op.or]: [searchWhere, { type: matchingTypes.flatMap(typeFilterValues) }] }
        : searchWhere,
    );
  }

  return { [Op.and]: and };
}

async function fetchPaymentDetails(id) {
  const payment = await Payment.findByPk(id, { include: PAYMENT_INCLUDES });
  if (!payment) return null;
  const [data] = await attachPaymentContext([payment]);
  return data;
}

/** Loads a payment locked for update; it must still be pending. */
async function lockPendingPayment(id, t) {
  const payment = await Payment.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!payment) throw httpError(404, "Payment not found");
  if (payment.status !== "pending") throw httpError(409, "This payment has already been processed");
  return payment;
}

/* ------------------------------------------------------------------ */
/* Lists & KPIs                                                        */
/* ------------------------------------------------------------------ */

/**
 * GET /payments?status=&type=&createdBy=&processedBy=&paymentDate=&paymentDateFrom=&paymentDateTo=&date=&code=&search=&page=&limit=
 * Pending tab -> status=pending, Approved tab -> status=processed.
 * Filters are described on buildListWhere.
 */
async function getPayments(req, res, next) {
  try {
    const { status } = req.query;
    if (status && !PAYMENT_STATUSES.includes(status)) {
      return error(res, 400, `status must be one of: ${PAYMENT_STATUSES.join(", ")}`);
    }
    const { page, limit, offset } = getPagination(req.query);

    const result = await Payment.findAndCountAll({
      where: await buildListWhere(req.query),
      include: PAYMENT_INCLUDES,
      order: [[status === "processed" ? "processedAt" : "createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const response = buildPaginatedResponse(result, page, limit);
    response.data = await attachPaymentContext(result.rows);
    return success(res, 200, "Payments fetched successfully", response);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /payments/summary — KPI cards + tab counts.
 * All "due" figures are computed from currently pending payments.
 */
async function getPaymentSummary(req, res, next) {
  try {
    const rows = await Payment.findAll({
      attributes: [
        "status",
        "type",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("amount")), "amount"],
      ],
      group: ["status", "type"],
      raw: true,
    });

    const pendingByType = {};
    const proccessedByType = {}
    const totals = { pending: { count: 0, amount: 0 }, processed: { count: 0, amount: 0 } };
    for (const row of rows) {
      const type = row.type === "expense" ? "supervisor" : row.type;
      const count = Number(row.count);
      const amount = Number(row.amount) || 0;
      totals[row.status].count += count;
      totals[row.status].amount += amount;
      if (row.status === "pending") {
        pendingByType[type] = {
          count: (pendingByType[type]?.count || 0) + count,
          amount: (pendingByType[type]?.amount || 0) + amount,
        };
      }
      if (row.status === "processed") {
        proccessedByType[type] = {
          count: (proccessedByType[type]?.count || 0) + count,
          amount: (proccessedByType[type]?.amount || 0) + amount,
        };
      }
    }

    return success(res, 200, "Payment summary fetched successfully", {
      data: {
        pendingPayments: totals.pending.count,
        dueAmount: totals.pending.amount,
        dueInsuranceAmount: pendingByType.insurance?.amount || 0,
        dueLabourAmount: pendingByType.labour?.amount || 0,
        pendingByType,
        processedPayments: totals.processed.count,
        processedAmount: totals.processed.amount,
        processedLabourAmount:proccessedByType.labour?.amount || 0,
        processedInsuranceAmount:proccessedByType.insurance?.amount || 0
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /payments/filter-options?status=pending|processed
 * Employees for the "Created by" / "Processed by" dropdowns — only people
 * who actually appear on payments in that tab.
 */
async function getPaymentFilterOptions(req, res, next) {
  try {
    const where = {};
    if (PAYMENT_STATUSES.includes(req.query.status)) where.status = req.query.status;

    const distinctIds = async (column) =>
      (
        await Payment.findAll({
          where: { ...where, [column]: { [Op.ne]: null } },
          attributes: [[fn("DISTINCT", col(column)), "id"]],
          raw: true,
        })
      ).map((r) => r.id);

    const [creatorIds, processorIds] = await Promise.all([
      distinctIds("createdBy"),
      distinctIds("processedBy"),
    ]);
    const employees = await Employee.findAll({
      where: { id: [...new Set([...creatorIds, ...processorIds])] },
      attributes: EMP_ATTRS,
      order: [["name", "ASC"]],
    });
    const pick = (ids) => employees.filter((e) => ids.includes(e.id));

    return success(res, 200, "Payment filter options fetched successfully", {
      data: { createdBy: pick(creatorIds), processedBy: pick(processorIds) },
    });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Details, editing & processing                                       */
/* ------------------------------------------------------------------ */

/** GET /payments/:id — process drawer (pending) or read-only details (processed) */
async function getPaymentById(req, res, next) {
  try {
    const data = await fetchPaymentDetails(req.params.id);
    if (!data) return error(res, 404, "Payment not found");
    return success(res, 200, "Payment fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /payments/:id — save processing details while Pending.
 * body: { paymentMode?, referenceId?, paymentDate?, remark? } — only what's sent changes.
 */
async function updatePaymentDetails(req, res, next) {
  try {
    const { data: details, message } = validatePaymentDetails(req.body);
    if (message) return error(res, 400, message);

    await sequelize.transaction(async (t) => {
      const payment = await lockPendingPayment(req.params.id, t);
      await payment.update(details, { transaction: t });
    });

    const data = await fetchPaymentDetails(req.params.id);
    return success(res, 200, "Payment details saved", { data });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /payments/:id/process — Pending -> Processed.
 * body (optional): { paymentMode?, referenceId?, paymentDate?, remark? } —
 * applied first, so the drawer can save and process in one click.
 * Requires payment mode + payment date (and reference ID for bank/UPI).
 * Records processedBy / processedAt; an expense-request payment also marks
 * that expense request as paid.
 */
async function processPayment(req, res, next) {
  try {
    const { data: details, message } = validatePaymentDetails(req.body);
    if (message) return error(res, 400, message);

    await sequelize.transaction(async (t) => {
      const payment = await lockPendingPayment(req.params.id, t);

      const final = { ...payment.get({ plain: true }), ...details };
      const missing = missingProcessDetails(final);
      if (missing) throw httpError(400, missing);

      await payment.update(
        { ...details, status: "processed", processedBy: req.employee.id, processedAt: new Date() },
        { transaction: t },
      );

      if (payment.sourceRequestType === "expense_request") {
        await ExpenseRequest.update(
          { status: "paid" },
          { where: { id: payment.sourceRequestId }, transaction: t },
        );
      }
    });

    const data = await fetchPaymentDetails(req.params.id);
    return success(res, 200, "Payment processed successfully", { data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPayments,
  getPaymentSummary,
  getPaymentFilterOptions,
  getPaymentById,
  updatePaymentDetails,
  processPayment,
};

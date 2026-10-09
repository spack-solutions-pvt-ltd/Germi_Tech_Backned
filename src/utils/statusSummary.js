"use strict";
const { fn, col } = require("sequelize");
const { success } = require("./response");
const { myRequestsScope } = require("./requestOwnership");

// KPI cards for request modules: counts per status + total.

const camelCase = (status) => status.replace(/_(\w)/g, (_, c) => c.toUpperCase());

/**
 * { total, pending, inProcess, ... } — every status in `statuses` is always
 * present (0 when there are none), keys in camelCase.
 */
async function summarizeByStatus(Model, statuses, where = {}) {
  const rows = await Model.findAll({
    where,
    attributes: ["status", [fn("COUNT", col("id")), "count"]],
    group: ["status"],
    raw: true,
  });
  const counts = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));

  const summary = { total: rows.reduce((sum, r) => sum + Number(r.count), 0) };
  for (const status of statuses) summary[camelCase(status)] = counts[status] || 0;
  return summary;
}

/**
 * Builds the two summary endpoints a request module needs:
 *   getMySummary — Requests page: raised for the logged-in user + created by them
 *   getSummary   — Verifications / Approvals pages: everyone's (optional ?requestedBy=)
 */
function createSummaryHandlers(Model, statuses, { ownerField = "requestedBy", label = "Request" } = {}) {
  const respond = async (res, where) =>
    success(res, 200, `${label} summary fetched successfully`, {
      data: await summarizeByStatus(Model, statuses, where),
    });

  return {
    getMySummary: async (req, res, next) => {
      try {
        return await respond(res, myRequestsScope(req.employee.id, ownerField)); // raised for me + created by me
      } catch (err) {
        next(err);
      }
    },
    getSummary: async (req, res, next) => {
      try {
        const where = {};
        if (req.query.requestedBy) where[ownerField] = req.query.requestedBy;
        return await respond(res, where);
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { summarizeByStatus, createSummaryHandlers };

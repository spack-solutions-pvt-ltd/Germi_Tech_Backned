"use strict";
const { httpError } = require("./response");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Reads page/limit off req.query, sanitizes them, and returns the values
 * plus the offset Sequelize needs. Invalid/missing values fall back to
 * sane defaults instead of erroring.
 */
function getPagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = DEFAULT_PAGE;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * True when the client asked for a page (sent page or limit). Endpoints use
 * this to return the full paginated list vs. a lightweight dropdown list.
 */
function hasPagination(query) {
  return query.page !== undefined || query.limit !== undefined;
}

const STATUSES = ["Active", "Inactive"];

/**
 * ?status=Active|Inactive -> { status } to spread into a where ({} when not
 * sent). Throws 400 for any other value.
 */
function statusFilter(status) {
  if (status === undefined || status === "") return {};
  if (!STATUSES.includes(status)) throw httpError(400, "status must be Active or Inactive");
  return { status };
}

/**
 * Wraps a Sequelize findAndCountAll() result ({ rows, count }) into a
 * consistent { data, meta } response shape.
 */
function buildPaginatedResponse({ rows, count }, page, limit) {
  return {
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.max(Math.ceil(count / limit), 1),
    },
  };
}

module.exports = { getPagination, hasPagination, statusFilter, buildPaginatedResponse };

"use strict";

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

module.exports = { getPagination, buildPaginatedResponse };

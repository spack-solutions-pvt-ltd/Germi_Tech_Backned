"use strict";
const { Op } = require("sequelize");
const { Employee } = require("../models");

// Ownership rules shared by request modules (loading, bags, send bags).
//
// A request has an owner (the supervisor it is for — requestedBy, or
// senderId for bag transfers) and a creator (createdBy — differs when
// someone raised it on the supervisor's behalf).
//   - owner and creator can edit it while it is still pending
//   - only the owner can NOT verify / approve / process it — an L1/L2 who
//     raised it on a supervisor's behalf may still verify / process it

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** True if the employee is the request's owner or the person who created it. */
function isRequestOwner(request, employee, ownerField = "requestedBy") {
  return request[ownerField] === employee.id || request.createdBy === employee.id;
}

/** True if the request is FOR this employee (the supervisor it was raised for / the sender). */
function isRequestFor(request, employee, ownerField = "requestedBy") {
  return request[ownerField] === employee.id;
}

/**
 * Throws 403 when the supervisor a request is for tries to verify, approve or
 * process it. Whoever created it on their behalf is allowed.
 */
function assertNotRequestOwner(request, employee, action, ownerField = "requestedBy") {
  if (isRequestFor(request, employee, ownerField)) {
    throw httpError(403, `You cannot ${action} your own request`);
  }
}

/** Throws 403 unless the employee is the owner/creator (used for edits). */
function assertRequestOwner(request, employee, ownerField = "requestedBy") {
  if (!isRequestOwner(request, employee, ownerField)) {
    throw httpError(403, "Only the person who created this request can edit it");
  }
}

/**
 * Who a new request is for. Defaults to the caller; pass a supervisor id
 * to raise it on their behalf (e.g. from the Verifications screen).
 */
async function resolveRequestOwner(onBehalfOf, employee) {
  if (!onBehalfOf || Number(onBehalfOf) === employee.id) return employee.id;
  const supervisor = await Employee.findByPk(onBehalfOf, { attributes: ["id"] });
  if (!supervisor) throw httpError(404, "Supervisor not found");
  return supervisor.id;
}

/**
 * where for a "my requests" list: requests raised FOR me (ownerField) plus
 * requests I created on someone else's behalf (createdBy). Wrapped in Op.and
 * so callers can still add their own Op.or (e.g. search).
 */
function myRequestsScope(employeeId, ownerField = "requestedBy") {
  return { [Op.and]: [{ [Op.or]: [{ [ownerField]: employeeId }, { createdBy: employeeId }] }] };
}

/**
 * Flags for one row of a "my requests" list, so the UI knows whether the
 * viewer may edit it:
 *   createdByMe     — the viewer created it (old rows without createdBy count
 *                     as created by their owner)
 *   createdOnBehalf — someone other than the supervisor created it for them
 *                     (e.g. L1 from the Requests page)
 *   canEdit         — createdByMe and still in an editable status
 */
function creatorFlags(request, viewerId, { ownerField = "requestedBy", editableStatuses = ["pending"] } = {}) {
  const creatorId = request.createdBy ?? request[ownerField];
  const createdByMe = creatorId === viewerId;
  return {
    createdByMe,
    createdOnBehalf: creatorId !== request[ownerField],
    canEdit: createdByMe && editableStatuses.includes(request.status),
  };
}

/** Model rows -> JSON with creatorFlags added. */
const withCreatorFlags = (rows, viewerId, options) =>
  rows.map((row) => {
    const json = typeof row.toJSON === "function" ? row.toJSON() : row;
    return { ...json, ...creatorFlags(json, viewerId, options) };
  });

module.exports = {
  myRequestsScope,
  creatorFlags,
  withCreatorFlags,
  isRequestOwner,
  isRequestFor,
  assertNotRequestOwner,
  assertRequestOwner,
  resolveRequestOwner,
};

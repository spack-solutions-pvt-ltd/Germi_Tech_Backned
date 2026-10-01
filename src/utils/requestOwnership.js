"use strict";
const { Employee } = require("../models");

// Ownership rules shared by request modules (loading, bags, send bags).
//
// A request has an owner (the supervisor it is for — requestedBy, or
// senderId for bag transfers) and a creator (createdBy — differs when
// someone raised it on the supervisor's behalf). Both of them:
//   - can edit it while it is still pending
//   - can NOT verify / approve / process it themselves

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** True if the employee is the request's owner or the person who created it. */
function isRequestOwner(request, employee, ownerField = "requestedBy") {
  return request[ownerField] === employee.id || request.createdBy === employee.id;
}

/** Throws 403 when the owner/creator tries to verify, approve or process their own request. */
function assertNotRequestOwner(request, employee, action, ownerField = "requestedBy") {
  if (isRequestOwner(request, employee, ownerField)) {
    throw httpError(403, `You cannot ${action} a request you created or that was raised for you`);
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

module.exports = {
  isRequestOwner,
  assertNotRequestOwner,
  assertRequestOwner,
  resolveRequestOwner,
};

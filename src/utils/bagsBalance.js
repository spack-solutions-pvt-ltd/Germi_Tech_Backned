"use strict";
const { BagsBalance } = require("../models");

const COUNTER_FIELDS = [
  "allottedBags",
  "receivedBags",
  "sharedInBags",
  "returnedBags",
  "sharedOutBags",
  "usedBags",
];

function computeAvailable(b) {
  return (
    b.allottedBags +
    b.receivedBags +
    b.sharedInBags -
    b.returnedBags -
    b.sharedOutBags -
    b.usedBags
  );
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Fetches (creating if missing) the balance row for a supervisor+allotment,
 * locked FOR UPDATE so concurrent movements on the same allotment queue up.
 * Must be called inside a transaction.
 */
async function getLockedBalance(supervisorId, allotmentVillageId, transaction) {
  await BagsBalance.findOrCreate({
    where: { supervisorId, allotmentVillageId },
    defaults: { supervisorId, allotmentVillageId },
    transaction,
  });
  return BagsBalance.findOne({
    where: { supervisorId, allotmentVillageId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

/**
 * Applies counter deltas, e.g. { receivedBags: 80 } or { sharedOutBags: 50 },
 * and recomputes availableBags. Throws a 409 if the supervisor would end up
 * with negative bags on that allotment.
 */
async function applyBagMovement({ supervisorId, allotmentVillageId, deltas }, transaction) {
  const balance = await getLockedBalance(supervisorId, allotmentVillageId, transaction);

  for (const [field, delta] of Object.entries(deltas)) {
    if (!COUNTER_FIELDS.includes(field)) throw new Error(`Unknown bag counter "${field}"`);
    balance[field] += Number(delta);
  }

  const available = computeAvailable(balance);
  if (available < 0) {
    throw httpError(409, "Not enough bags available for this allotment");
  }
  balance.availableBags = available;
  await balance.save({ transaction });
  return balance;
}

/** Read-only current balance (zeros if the supervisor has no movements yet). */
async function getBalance(supervisorId, allotmentVillageId, transaction) {
  const row = await BagsBalance.findOne({
    where: { supervisorId, allotmentVillageId },
    transaction,
  });
  if (row) return row.toJSON();
  const empty = { supervisorId: Number(supervisorId), allotmentVillageId: Number(allotmentVillageId) };
  COUNTER_FIELDS.forEach((f) => (empty[f] = 0));
  empty.availableBags = 0;
  return empty;
}

module.exports = { applyBagMovement, getLockedBalance, getBalance, httpError };

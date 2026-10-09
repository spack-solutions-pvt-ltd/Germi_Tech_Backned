"use strict";
const { httpError } = require("./bagsBalance");

// A village allotment (AllotmentVillage) is "open" or "closed". Once closed
// it disappears for the supervisor: not in any allotment dropdown / list, and
// it can't be picked on a new request. Requests already raised against it
// keep it (an edit may keep the allotments the request already has).

const OPEN_ALLOTMENT = { status: "open" };

/** Payload value -> stored value: "open" / "opened" -> "open", "closed" -> "closed", else null. */
function normalizeAllotmentStatus(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "open" || v === "opened") return "open";
  if (v === "closed" || v === "close") return "closed";
  return null;
}

/**
 * Throws 400 when `av` is closed — unless its id is in `keepIds` (the
 * allotments a request being edited already has).
 */
function assertAllotmentOpen(av, label = "Allotment", keepIds = []) {
  if (av?.status !== "closed") return;
  if (keepIds.map(Number).includes(Number(av.id))) return;
  throw httpError(400, `${label}: this allotment is closed — choose an open allotment`);
}

module.exports = { OPEN_ALLOTMENT, normalizeAllotmentStatus, assertAllotmentOpen };

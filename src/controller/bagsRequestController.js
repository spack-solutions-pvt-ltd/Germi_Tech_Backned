"use strict";
const { Op, fn, col } = require("sequelize");
const {
  sequelize,
  BagsRequest,
  BagsRequestCropEntry,
  BagsRequestStatusLog,
  AllotmentVillage,
  Employee,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");
const { applyBagMovement, httpError } = require("../utils/bagsBalance");
const {
  EMP_ATTRS,
  allotmentVillageInclude,
  isProcessor,
  toPositiveInt,
  toNonNegativeInt,
} = require("../utils/bagsCommon");
const { resolveRequestOwner, assertRequestOwner } = require("../utils/requestOwnership");

// Allowed transitions. There is no Approval-page stage for bags. A request
// can be cancelled at any stage until it is received; a "received" request
// can go back to "bags_sent" whenever L2 sends more bags.
const STATUS_FLOW = {
  pending: ["in_process", "cancelled"],
  in_process: ["bags_sent", "cancelled"],
  bags_sent: ["received", "not_received", "cancelled"],
  not_received: ["bags_sent", "cancelled"],
  received: ["bags_sent"],
};

const HEADER_INCLUDES = [
  { model: Employee, as: "requester", attributes: EMP_ATTRS },
  { model: Employee, as: "creator", attributes: EMP_ATTRS },
  { model: Employee, as: "canceller", attributes: EMP_ATTRS },
];

const ENTRY_INCLUDE = {
  model: BagsRequestCropEntry,
  as: "cropEntries",
  separate: true, // own query, so it can't multiply parent rows / break pagination
  include: allotmentVillageInclude("allotmentVillage"),
};

const STATUS_LOG_INCLUDE = {
  model: BagsRequestStatusLog,
  as: "statusLogs",
  separate: true,
  order: [["createdAt", "ASC"]],
  include: { model: Employee, as: "actor", attributes: EMP_ATTRS },
};

function parseCropEntries(raw) {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "cropEntries must be valid JSON");
  }
}

/** Adds bag totals across the crop entries. */
function decorate(request) {
  const json = request.toJSON();
  if (!json.cropEntries) return json;
  const sum = (key) =>
    json.cropEntries.reduce((acc, e) => acc + (e[key] || 0), 0);
  json.cropEntries = json.cropEntries.map((e) => ({
    ...e,
    remainingBags: Math.max(e.requiredBags - e.receivedBags - e.sentBags, 0),
  }));
  json.totalRequiredBags = sum("requiredBags");
  json.totalSentBags = sum("sentBags");
  json.totalReceivedBags = sum("receivedBags");
  json.remainingBags = sum("remainingBags");
  return json;
}

async function logStatus(
  bagsRequestId,
  fromStatus,
  toStatus,
  changedBy,
  bagsCount,
  note,
  transaction,
) {
  return BagsRequestStatusLog.create(
    {
      bagsRequestId,
      fromStatus,
      toStatus,
      changedBy,
      bagsCount: bagsCount ?? null,
      note: note || null,
    },
    { transaction },
  );
}

async function fetchFull(id) {
  return BagsRequest.findByPk(id, {
    include: [...HEADER_INCLUDES, ENTRY_INCLUDE, STATUS_LOG_INCLUDE],
  });
}

/** Validates crop entries against the supervisor the request is for. */
async function validateEntries(cropEntries, supervisorId) {
  if (!Array.isArray(cropEntries) || !cropEntries.length) {
    throw httpError(400, "At least one crop entry is required");
  }
  const seen = new Set();
  const cleaned = [];
  for (const entry of cropEntries) {
    const avId = Number(entry.allotmentVillageId);
    if (!avId)
      throw httpError(
        400,
        "allotmentVillageId is required in every crop entry",
      );
    const requiredBags = toPositiveInt(entry.requiredBags);
    if (!requiredBags) {
      throw httpError(
        400,
        "requiredBags must be a positive whole number in every crop entry",
      );
    }
    if (seen.has(avId))
      throw httpError(400, `allotmentVillageId ${avId} appears more than once`);
    seen.add(avId);

    const av = await AllotmentVillage.findByPk(avId);
    if (!av) throw httpError(404, `AllotmentVillage ${avId} not found`);
    if (av.supervisorId !== supervisorId) {
      throw httpError(
        403,
        `Employee ${supervisorId} is not the assigned supervisor for allotmentVillageId ${avId}`,
      );
    }
    cleaned.push({ allotmentVillageId: avId, requiredBags });
  }
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* Lists & summary                                                     */
/* ------------------------------------------------------------------ */

/** Shared list logic — `baseWhere` is built by the caller so "mine" vs "everyone's" can differ. */
async function listBagsRequests(baseWhere, req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, village: villageId, search } = req.query;

    const where = { ...baseWhere };
    if (status) where.status = status;
    if (search) where.requestCode = { [Op.like]: `%${search}%` };
    if (villageId) {
      const entries = await BagsRequestCropEntry.findAll({
        attributes: ["bagsRequestId"],
        include: {
          model: AllotmentVillage,
          as: "allotmentVillage",
          attributes: [],
          where: { villageId },
        },
      });
      where.id = entries.map((e) => e.bagsRequestId);
    }

    const result = await BagsRequest.findAndCountAll({
      where,
      include: [...HEADER_INCLUDES, ENTRY_INCLUDE],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const response = buildPaginatedResponse(result, page, limit);
    response.data = result.rows.map(decorate);
    return success(res, 200, "Bags requests fetched successfully", response);
  } catch (err) {
    next(err);
  }
}

/** GET /bag-requests/my-requests — Requests → Bags: own requests */
async function getMyBagsRequests(req, res, next) {
  return listBagsRequests({ requestedBy: req.employee.id }, req, res, next);
}

/** GET /bag-requests — Verifications → Bags: every supervisor's requests */
async function getAllBagsRequests(req, res, next) {
  const where = {};
  if (req.query.requestedBy) where.requestedBy = req.query.requestedBy;
  return listBagsRequests(where, req, res, next);
}

/** GET /bag-requests/:id — details drawer, including status history */
async function getBagsRequestById(req, res, next) {
  try {
    const request = await fetchFull(req.params.id);
    if (!request) return error(res, 404, "Bags request not found");
    const canView =
      isProcessor(req.employee) ||
      request.requestedBy === req.employee.id ||
      request.createdBy === req.employee.id;
    if (!canView)
      return error(res, 403, "You don't have access to this bags request");

    return success(res, 200, "Bags request fetched successfully", {
      data: decorate(request),
    });
  } catch (err) {
    next(err);
  }
}

async function buildSummary(where) {
  const rows = await BagsRequest.findAll({
    where,
    attributes: ["status", [fn("COUNT", col("id")), "count"]],
    group: ["status"],
    raw: true,
  });
  const byStatus = Object.fromEntries(
    rows.map((r) => [r.status, Number(r.count)]),
  );
  return {
    total: rows.reduce((a, r) => a + Number(r.count), 0),
    pending: byStatus.pending || 0,
    inProcess: byStatus.in_process || 0,
    bagsSent: byStatus.bags_sent || 0,
    received: byStatus.received || 0,
    notReceived: byStatus.not_received || 0,
    cancelled: byStatus.cancelled || 0,
  };
}

/** GET /bag-requests/my-summary */
async function getMyBagsSummary(req, res, next) {
  try {
    const data = await buildSummary({ requestedBy: req.employee.id });
    return success(res, 200, "Bags summary fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

/** GET /bag-requests/summary — Verifications cards across all supervisors */
async function getBagsSummary(req, res, next) {
  try {
    const where = {};
    if (req.query.requestedBy) where.requestedBy = req.query.requestedBy;
    const data = await buildSummary(where);
    return success(res, 200, "Bags summary fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Create / Update                                                     */
/* ------------------------------------------------------------------ */

/**
 * POST /bag-requests — Add Request
 * body: { cropEntries: [{ allotmentVillageId, requiredBags }], note?, requestedBy? }
 * Pass requestedBy to raise it on a supervisor's behalf.
 */
async function createBagsRequest(req, res, next) {
  try {
    const { requestedBy: onBehalfOf, note } = req.body;
    const requestedBy = await resolveRequestOwner(onBehalfOf, req.employee);

    const cropEntries = await validateEntries(
      parseCropEntries(req.body.cropEntries),
      requestedBy,
    );
    const totalRequired = cropEntries.reduce((a, e) => a + e.requiredBags, 0);

    const id = await sequelize.transaction(async (t) => {
      const created = await BagsRequest.create(
        {
          requestedBy,
          createdBy: req.employee.id,
          status: "pending",
          note: note || null,
        },
        { transaction: t },
      );
      await created.update(
        { requestCode: generateId("BR", created.id) },
        { transaction: t },
      );
      await BagsRequestCropEntry.bulkCreate(
        cropEntries.map((e) => ({ ...e, bagsRequestId: created.id })),
        { transaction: t },
      );
      await logStatus(
        created.id,
        null,
        "pending",
        req.employee.id,
        totalRequired,
        "Request created",
        t,
      );
      return created.id;
    });

    return success(res, 201, "Bags request created successfully", {
      data: decorate(await fetchFull(id)),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /bag-requests/:id — edit while still Pending, by the supervisor or
 * whoever created it on their behalf.
 * body: { cropEntries?, note? } — cropEntries, if provided, REPLACES the full set.
 */
async function updateBagsRequest(req, res, next) {
  try {
    const request = await BagsRequest.findByPk(req.params.id);
    if (!request) return error(res, 404, "Bags request not found");
    assertRequestOwner(request, req.employee);
    if (request.status !== "pending") {
      return error(res, 409, "Bags requests can only be edited while Pending");
    }

    const rawEntries = parseCropEntries(req.body.cropEntries);
    const cropEntries =
      rawEntries !== undefined
        ? await validateEntries(rawEntries, request.requestedBy)
        : undefined;

    await sequelize.transaction(async (t) => {
      if (cropEntries) {
        await BagsRequestCropEntry.destroy({
          where: { bagsRequestId: request.id },
          transaction: t,
        });
        await BagsRequestCropEntry.bulkCreate(
          cropEntries.map((e) => ({ ...e, bagsRequestId: request.id })),
          { transaction: t },
        );
      }
      if (req.body.note !== undefined) {
        await request.update({ note: req.body.note }, { transaction: t });
      }
    });

    return success(res, 200, "Bags request updated successfully", {
      data: decorate(await fetchFull(request.id)),
    });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Status update                                                       */
/* ------------------------------------------------------------------ */

/** Who may perform a transition. Returns an error message, or null if allowed. */
function authorizeTransition(request, toStatus, employee) {
  if (["in_process", "bags_sent"].includes(toStatus)) {
    if (isRequestOwner(request, employee)) {
      return "You cannot process a request you created or that was raised for you";
    }
    return isProcessor(employee)
      ? null
      : "Only L1/L2 can process and dispatch bags requests";
  }
  if (["received", "not_received"].includes(toStatus)) {
    return request.requestedBy === employee.id
      ? null
      : "Only the requesting supervisor can confirm receipt";
  }
  if (toStatus === "cancelled") {
    return isRequestOwner(request, employee) || isProcessor(employee)
      ? null
      : "You cannot cancel this bags request";
  }
  return "You cannot perform this action";
}

async function lockEntries(request, t) {
  return BagsRequestCropEntry.findAll({
    where: { bagsRequestId: request.id },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
}

/**
 * Applies L2's per-entry edits: [{ id, requiredBags?, sentBags? }].
 * sentBags is NOT capped by requiredBags — L2 may send fewer or more.
 */
function applyEntryUpdates(entries, entryUpdates) {
  for (const update of entryUpdates || []) {
    const entry = entries.find((e) => e.id === Number(update.id));
    if (!entry)
      throw httpError(
        400,
        `Crop entry ${update.id} does not belong to this request`,
      );
    if (update.requiredBags !== undefined) {
      const required = toPositiveInt(update.requiredBags);
      if (!required)
        throw httpError(400, "requiredBags must be a positive whole number");
      entry.requiredBags = required;
    }
    if (update.sentBags !== undefined) {
      const sent = toNonNegativeInt(update.sentBags);
      if (sent === null)
        throw httpError(400, "sentBags must be a whole number ≥ 0");
      entry.sentBags = sent;
    }
  }
}

/**
 * PUT /bag-requests/:id/status
 * body: { status, note?, reason?, cropEntries? }
 *
 * pending → in_process                    L1/L2 — may correct requiredBags: cropEntries [{ id, requiredBags }]
 * in_process | received → bags_sent       L1/L2 — cropEntries [{ id, sentBags, requiredBags? }] (any quantity)
 * not_received → bags_sent                L1/L2 — re-dispatch; cropEntries optional (keeps last quantities)
 * bags_sent → received                    requesting supervisor — sent bags are added to their allotment balance
 * bags_sent → not_received                requesting supervisor — nothing added
 * pending | in_process | bags_sent | not_received → cancelled   requester / creator / L1/L2
 */
async function updateBagsRequestStatus(req, res, next) {
  try {
    const { status: toStatus, note, reason } = req.body;
    if (!toStatus) return error(res, 400, "status is required");
    const entryUpdates = parseCropEntries(req.body.cropEntries);
    if (entryUpdates !== undefined && !Array.isArray(entryUpdates)) {
      return error(res, 400, "cropEntries must be an array");
    }

    await sequelize.transaction(async (t) => {
      const request = await BagsRequest.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!request) throw httpError(404, "Bags request not found");

      const fromStatus = request.status;
      if (!(STATUS_FLOW[fromStatus] || []).includes(toStatus)) {
        throw httpError(
          409,
          `Cannot move a bags request from "${fromStatus}" to "${toStatus}"`,
        );
      }
      const denied = authorizeTransition(request, toStatus, req.employee);
      if (denied) throw httpError(403, denied);

      const updates = { status: toStatus };
      let bagsCount = null;

      if (toStatus === "in_process" && entryUpdates) {
        const entries = await lockEntries(request, t);
        applyEntryUpdates(
          entries,
          entryUpdates.map(({ id, requiredBags }) => ({ id, requiredBags })),
        );
        await Promise.all(entries.map((e) => e.save({ transaction: t })));
      }

      if (toStatus === "bags_sent") {
        if (!entryUpdates && fromStatus !== "not_received") {
          throw httpError(
            400,
            "cropEntries with sentBags are required to mark bags sent",
          );
        }
        const entries = await lockEntries(request, t);
        // A fresh dispatch starts from zero; a re-dispatch after not_received keeps the last quantities.
        if (fromStatus !== "not_received")
          entries.forEach((e) => (e.sentBags = 0));
        applyEntryUpdates(entries, entryUpdates);
        bagsCount = entries.reduce((a, e) => a + e.sentBags, 0);
        if (bagsCount <= 0)
          throw httpError(400, "At least one bag must be sent");
        await Promise.all(entries.map((e) => e.save({ transaction: t })));
      }

      if (toStatus === "received") {
        const entries = await lockEntries(request, t);
        bagsCount = 0;
        for (const entry of entries) {
          if (!entry.sentBags) continue;
          await applyBagMovement(
            {
              supervisorId: request.requestedBy,
              allotmentVillageId: entry.allotmentVillageId,
              deltas: { receivedBags: entry.sentBags },
            },
            t,
          );
          bagsCount += entry.sentBags;
          entry.receivedBags += entry.sentBags;
          entry.sentBags = 0;
          await entry.save({ transaction: t });
        }
      }

      if (toStatus === "cancelled") {
        Object.assign(updates, {
          cancelledBy: req.employee.id,
          cancelledAt: new Date(),
          cancellationReason: reason || note || null,
        });
      }

      await request.update(updates, { transaction: t });
      await logStatus(
        request.id,
        fromStatus,
        toStatus,
        req.employee.id,
        bagsCount,
        note || reason,
        t,
      );
    });

    return success(res, 200, "Bags request status updated successfully", {
      data: decorate(await fetchFull(req.params.id)),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyBagsRequests,
  getAllBagsRequests,
  getBagsRequestById,
  getMyBagsSummary,
  getBagsSummary,
  createBagsRequest,
  updateBagsRequest,
  updateBagsRequestStatus,
};

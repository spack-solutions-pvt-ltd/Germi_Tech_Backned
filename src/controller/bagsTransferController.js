"use strict";
const { Op, fn, col } = require("sequelize");
const {
  sequelize,
  BagsTransfer,
  BagsTransferStatusLog,
  BagsBalance,
  AllotmentVillage,
  SeedCompany,
  Employee,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");
const {
  applyBagMovement,
  getLockedBalance,
  getBalance,
  httpError,
} = require("../utils/bagsBalance");
const {
  EMP_ATTRS,
  AV_DETAIL_INCLUDE,
  allotmentVillageInclude,
  toAllotmentOption,
  isProcessor,
  toPositiveInt,
} = require("../utils/bagsCommon");
const {
  isRequestOwner,
  assertRequestOwner,
  resolveRequestOwner,
} = require("../utils/requestOwnership");

const GERMITECH_COMPANY_NAME = "Germi Tech Company";

// Balances move only on "received". not_received keeps the bags committed
// (they may still turn up); cancelled releases them without any movement.
const STATUS_FLOW = {
  pending: ["received", "not_received", "cancelled"],
  not_received: ["received", "cancelled"],
};

// Statuses whose bags are still committed from the sender's allotment.
const OPEN_STATUSES = ["pending", "not_received"];

const HEADER_INCLUDES = [
  { model: Employee, as: "sender", attributes: EMP_ATTRS },
  { model: Employee, as: "creator", attributes: EMP_ATTRS },
  { model: Employee, as: "toSupervisor", attributes: EMP_ATTRS },
  { model: Employee, as: "receiver", attributes: EMP_ATTRS },
  { model: Employee, as: "canceller", attributes: EMP_ATTRS },
  { model: SeedCompany, as: "toCompany", attributes: ["id", "name"] },
  allotmentVillageInclude("fromAllotmentVillage"),
  allotmentVillageInclude("toAllotmentVillage"),
];

const STATUS_LOG_INCLUDE = {
  model: BagsTransferStatusLog,
  as: "statusLogs",
  separate: true,
  order: [["createdAt", "ASC"]],
  include: { model: Employee, as: "actor", attributes: EMP_ATTRS },
};

/** Adds direction (for the viewer) and a display name for the destination. */
function decorate(transfer, viewerId) {
  const json = transfer.toJSON();
  json.direction = json.senderId === viewerId ? "outgoing" : json.toSupervisorId === viewerId ? "incoming" : null;
  json.destinationName =
    json.type === "shared"
      ? json.toSupervisor?.name || null
      : json.toCompanyType === "germitech"
        ? GERMITECH_COMPANY_NAME
        : json.toCompany?.name || null;
  return json;
}

async function logStatus(bagsTransferId, fromStatus, toStatus, changedBy, bagsCount, note, transaction) {
  return BagsTransferStatusLog.create(
    { bagsTransferId, fromStatus, toStatus, changedBy, bagsCount, note: note || null },
    { transaction },
  );
}

async function fetchFull(id) {
  return BagsTransfer.findByPk(id, { include: [...HEADER_INCLUDES, STATUS_LOG_INCLUDE] });
}

/**
 * Bags on the sender's allotment already committed to open (pending / not
 * received) transfers. `excludeId` leaves out the transfer being edited.
 */
async function getCommittedBags(senderId, fromAllotmentVillageId, transaction, excludeId = null) {
  const total = await BagsTransfer.sum("bags", {
    where: {
      senderId,
      fromAllotmentVillageId,
      status: OPEN_STATUSES,
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction,
  });
  return total || 0;
}

/* ------------------------------------------------------------------ */
/* Lists & summary                                                     */
/* ------------------------------------------------------------------ */

async function listBagsTransfers(baseWhere, req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, type, villageId, search } = req.query;

    const and = [baseWhere];
    if (status) and.push({ status });
    if (type) and.push({ type });
    if (search) and.push({ transferCode: { [Op.like]: `%${search}%` } });
    if (villageId) {
      const avIds = (await AllotmentVillage.findAll({ where: { villageId }, attributes: ["id"] })).map((a) => a.id);
      and.push({ [Op.or]: [{ fromAllotmentVillageId: avIds }, { toAllotmentVillageId: avIds }] });
    }

    const result = await BagsTransfer.findAndCountAll({
      where: { [Op.and]: and },
      include: HEADER_INCLUDES,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const response = buildPaginatedResponse(result, page, limit);
    response.data = result.rows.map((r) => decorate(r, req.employee.id));
    return success(res, 200, "Bags transfers fetched successfully", response);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /bag-transfers/my-transfers?direction=outgoing|incoming
 * Bags I sent + bags other supervisors shared with me.
 */
async function getMyBagsTransfers(req, res, next) {
  const me = req.employee.id;
  const { direction } = req.query;
  const where =
    direction === "outgoing"
      ? { senderId: me }
      : direction === "incoming"
        ? { toSupervisorId: me }
        : { [Op.or]: [{ senderId: me }, { toSupervisorId: me }] };
  return listBagsTransfers(where, req, res, next);
}

/** GET /bag-transfers — Verifications → Bags: every transfer */
async function getAllBagsTransfers(req, res, next) {
  const where = {};
  if (req.query.senderId) where.senderId = req.query.senderId;
  return listBagsTransfers(where, req, res, next);
}

/** GET /bag-transfers/:id — details drawer, including status history */
async function getBagsTransferById(req, res, next) {
  try {
    const transfer = await fetchFull(req.params.id);
    if (!transfer) return error(res, 404, "Bags transfer not found");
    const canView =
      isProcessor(req.employee) ||
      isRequestOwner(transfer, req.employee, "senderId") ||
      transfer.toSupervisorId === req.employee.id;
    if (!canView) return error(res, 403, "You don't have access to this bags transfer");

    return success(res, 200, "Bags transfer fetched successfully", {
      data: decorate(transfer, req.employee.id),
    });
  } catch (err) {
    next(err);
  }
}

async function countByStatus(where) {
  const rows = await BagsTransfer.findAll({
    where,
    attributes: ["status", [fn("COUNT", col("id")), "count"], [fn("SUM", col("bags")), "bags"]],
    group: ["status"],
    raw: true,
  });
  const out = { total: 0, totalBags: 0 };
  for (const r of rows) {
    out[r.status] = { count: Number(r.count), bags: Number(r.bags) || 0 };
    out.total += Number(r.count);
    out.totalBags += Number(r.bags) || 0;
  }
  return out;
}

/** GET /bag-transfers/my-summary — sent / incoming counts + bags currently with me */
async function getMyBagsTransferSummary(req, res, next) {
  try {
    const me = req.employee.id;
    const [outgoing, incoming, bagsWithMe] = await Promise.all([
      countByStatus({ senderId: me }),
      countByStatus({ toSupervisorId: me }),
      BagsBalance.sum("availableBags", { where: { supervisorId: me } }),
    ]);
    return success(res, 200, "Bags transfer summary fetched successfully", {
      data: { outgoing, incoming, bagsWithMe: bagsWithMe || 0 },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /bag-transfers/summary — Verifications cards */
async function getBagsTransferSummary(req, res, next) {
  try {
    const [returns, shared] = await Promise.all([
      countByStatus({ type: "return" }),
      countByStatus({ type: "shared" }),
    ]);
    return success(res, 200, "Bags transfer summary fetched successfully", {
      data: { return: returns, shared },
    });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Send Bags drawer dropdowns                                          */
/* ------------------------------------------------------------------ */

/**
 * GET /bag-transfers/my-allotments?supervisorId= — "Select allotment" + "Bags with him".
 * Defaults to the caller; pass supervisorId when sending on a supervisor's behalf.
 * bagsWithHim   = current balance on that allotment
 * committedBags = already on open (pending / not received) transfers
 * sendableBags  = bagsWithHim - committedBags (max for a new send)
 */
async function getMyAllotmentsWithBags(req, res, next) {
  try {
    const me = Number(req.query.supervisorId) || req.employee.id;
    const [rows, balances, committed] = await Promise.all([
      AllotmentVillage.findAll({ where: { supervisorId: me }, include: AV_DETAIL_INCLUDE, order: [["createdAt", "DESC"]] }),
      BagsBalance.findAll({ where: { supervisorId: me } }),
      BagsTransfer.findAll({
        where: { senderId: me, status: OPEN_STATUSES },
        attributes: ["fromAllotmentVillageId", [fn("SUM", col("bags")), "bags"]],
        group: ["fromAllotmentVillageId"],
        raw: true,
      }),
    ]);
    const balanceByAv = new Map(balances.map((b) => [b.allotmentVillageId, b.availableBags]));
    const committedByAv = new Map(committed.map((c) => [c.fromAllotmentVillageId, Number(c.bags) || 0]));

    const data = rows.map((av) => {
      const bagsWithHim = balanceByAv.get(av.id) || 0;
      const committedBags = committedByAv.get(av.id) || 0;
      return {
        ...toAllotmentOption(av),
        bagsWithHim,
        committedBags,
        sendableBags: Math.max(bagsWithHim - committedBags, 0),
      };
    });
    return success(res, 200, "Allotments fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

/** GET /bag-transfers/balance/:allotmentVillageId — full ledger for one allotment */
async function getBagsBalance(req, res, next) {
  try {
    const av = await AllotmentVillage.findByPk(req.params.allotmentVillageId);
    if (!av) return error(res, 404, "Allotment-village not found");
    if (av.supervisorId !== req.employee.id && !isProcessor(req.employee)) {
      return error(res, 403, "You are not the supervisor of this allotment");
    }
    const balance = await getBalance(av.supervisorId, av.id);
    const committedBags = await getCommittedBags(av.supervisorId, av.id);
    return success(res, 200, "Bags balance fetched successfully", {
      data: { ...balance, committedBags, sendableBags: Math.max(balance.availableBags - committedBags, 0) },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /bag-transfers/companies — "Company" dropdown: Germi Tech + seed companies */
async function getDestinationCompanies(req, res, next) {
  try {
    const seedCompanies = await SeedCompany.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] });
    const data = [
      { toCompanyType: "germitech", toCompanyId: null, name: GERMITECH_COMPANY_NAME },
      ...seedCompanies.map((c) => ({ toCompanyType: "seed_company", toCompanyId: c.id, name: c.name })),
    ];
    return success(res, 200, "Companies fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

/** GET /bag-transfers/supervisors?senderId= — "Supervisor" dropdown (every active L3 except the sender) */
async function getSupervisors(req, res, next) {
  try {
    // Exclude the sender — the caller, or ?senderId= when sending on a supervisor's behalf.
    const senderId = Number(req.query.senderId) || req.employee.id;
    const data = await Employee.findAll({
      where: { level: "L3", status: "Active", id: { [Op.ne]: senderId } },
      attributes: ["id", "empId", "name", "level"],
      order: [["name", "ASC"]],
    });
    return success(res, 200, "Supervisors fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

/** GET /bag-transfers/supervisors/:supervisorId/allotments — "Supervisor allotment" dropdown */
async function getSupervisorAllotments(req, res, next) {
  try {
    const rows = await AllotmentVillage.findAll({
      where: { supervisorId: req.params.supervisorId },
      include: AV_DETAIL_INCLUDE,
      order: [["createdAt", "DESC"]],
    });
    return success(res, 200, "Allotments fetched successfully", { data: rows.map(toAllotmentOption) });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Send bags                                                           */
/* ------------------------------------------------------------------ */

/**
 * Validates the Send bags form and returns the BagsTransfer columns it maps to.
 * input: { fromAllotmentVillageId, bags, note?, sendTo: "company" | "supervisor",
 *          company:    toCompanyType: "germitech" | "seed_company", toCompanyId (seed_company only)
 *          supervisor: toSupervisorId, toAllotmentVillageId }
 */
async function buildTransferFields(input, senderId) {
  const { fromAllotmentVillageId, sendTo, toCompanyType, toCompanyId, toSupervisorId, toAllotmentVillageId } = input;

  const bags = toPositiveInt(input.bags);
  if (!bags) throw httpError(400, "bags must be a positive whole number");
  if (!fromAllotmentVillageId) throw httpError(400, "fromAllotmentVillageId is required");

  const fromAv = await AllotmentVillage.findByPk(fromAllotmentVillageId);
  if (!fromAv) throw httpError(404, "Allotment-village not found");
  if (fromAv.supervisorId !== senderId) {
    throw httpError(403, "The selected allotment is not assigned to the sending supervisor");
  }

  // Every destination column is reset, so switching company <-> supervisor on edit leaves nothing stale.
  const fields = {
    fromAllotmentVillageId: fromAv.id,
    bags,
    note: input.note || null,
    toCompanyType: null,
    toCompanyId: null,
    toSupervisorId: null,
    toAllotmentVillageId: null,
  };

  if (sendTo === "company") {
    if (!["germitech", "seed_company"].includes(toCompanyType)) {
      throw httpError(400, 'toCompanyType must be "germitech" or "seed_company"');
    }
    fields.type = "return";
    fields.toCompanyType = toCompanyType;
    if (toCompanyType === "seed_company") {
      const company = toCompanyId && (await SeedCompany.findByPk(toCompanyId));
      if (!company) throw httpError(404, "Seed company not found");
      fields.toCompanyId = company.id;
    }
    return fields;
  }

  if (sendTo === "supervisor") {
    if (!toSupervisorId || !toAllotmentVillageId) {
      throw httpError(400, "toSupervisorId and toAllotmentVillageId are required");
    }
    if (Number(toSupervisorId) === senderId) throw httpError(400, "Bags cannot be sent to the same supervisor");
    const receiver = await Employee.findByPk(toSupervisorId);
    if (!receiver) throw httpError(404, "Supervisor not found");
    const toAv = await AllotmentVillage.findByPk(toAllotmentVillageId);
    if (!toAv || toAv.supervisorId !== receiver.id) {
      throw httpError(400, "Selected allotment does not belong to the selected supervisor");
    }
    fields.type = "shared";
    fields.toSupervisorId = receiver.id;
    fields.toAllotmentVillageId = toAv.id;
    return fields;
  }

  throw httpError(400, 'sendTo must be "company" or "supervisor"');
}

/**
 * Throws 409 if the sender can't spare `bags` from the allotment. Locks the
 * balance row so two sends from the same allotment can't both pass.
 */
async function assertSendable(senderId, fromAllotmentVillageId, bags, t, excludeTransferId = null) {
  const balance = await getLockedBalance(senderId, fromAllotmentVillageId, t);
  const committed = await getCommittedBags(senderId, fromAllotmentVillageId, t, excludeTransferId);
  const sendable = balance.availableBags - committed;
  if (bags > sendable) {
    throw httpError(409, `Only ${Math.max(sendable, 0)} bags can be sent from this allotment`);
  }
}

/**
 * POST /bag-transfers — Send bags. Can be called any number of times.
 * body: the Send bags form (see buildTransferFields) + senderId? to send on
 * a supervisor's behalf.
 * Nothing is deducted yet — the bags are only checked against what is still
 * sendable on that allotment. The move happens when the transfer is Received.
 */
async function createBagsTransfer(req, res, next) {
  try {
    const senderId = await resolveRequestOwner(req.body.senderId, req.employee);
    const fields = await buildTransferFields(req.body, senderId);

    const id = await sequelize.transaction(async (t) => {
      await assertSendable(senderId, fields.fromAllotmentVillageId, fields.bags, t);
      const created = await BagsTransfer.create(
        { ...fields, senderId, createdBy: req.employee.id, status: "pending" },
        { transaction: t },
      );
      await created.update({ transferCode: generateId("BT", created.id) }, { transaction: t });
      await logStatus(created.id, null, "pending", req.employee.id, fields.bags, fields.note, t);
      return created.id;
    });

    return success(res, 201, "Bags sent successfully", { data: decorate(await fetchFull(id), req.employee.id) });
  } catch (err) {
    next(err);
  }
}

/** Current destination of a transfer in the Send bags form's shape. */
const transferAsInput = (transfer) => ({
  fromAllotmentVillageId: transfer.fromAllotmentVillageId,
  bags: transfer.bags,
  note: transfer.note,
  sendTo: transfer.type === "return" ? "company" : "supervisor",
  toCompanyType: transfer.toCompanyType,
  toCompanyId: transfer.toCompanyId,
  toSupervisorId: transfer.toSupervisorId,
  toAllotmentVillageId: transfer.toAllotmentVillageId,
});

/**
 * PUT /bag-transfers/:id — edit while Pending, by the sender or whoever
 * created it on their behalf. Same fields as create; anything not sent keeps
 * its current value.
 */
async function updateBagsTransfer(req, res, next) {
  try {
    await sequelize.transaction(async (t) => {
      const transfer = await BagsTransfer.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!transfer) throw httpError(404, "Bags transfer not found");
      assertRequestOwner(transfer, req.employee, "senderId");
      if (transfer.status !== "pending") throw httpError(409, "Transfers can only be edited while Pending");

      const changes = Object.fromEntries(Object.entries(req.body || {}).filter(([, v]) => v !== undefined));
      const fields = await buildTransferFields({ ...transferAsInput(transfer), ...changes }, transfer.senderId);
      await assertSendable(transfer.senderId, fields.fromAllotmentVillageId, fields.bags, t, transfer.id);

      await transfer.update(fields, { transaction: t });
      await logStatus(transfer.id, "pending", "pending", req.employee.id, fields.bags, "Transfer edited", t);
    });

    return success(res, 200, "Bags transfer updated successfully", {
      data: decorate(await fetchFull(req.params.id), req.employee.id),
    });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Status update                                                       */
/* ------------------------------------------------------------------ */

/**
 * Who confirms the other end: the receiving supervisor for 'shared', L1/L2
 * for 'return' (company) — never the sender or whoever created it for them.
 * The receiver, the sender or the creator may cancel.
 */
function authorizeTransition(transfer, toStatus, employee) {
  const isOwner = isRequestOwner(transfer, employee, "senderId");
  const isReceiver =
    transfer.type === "shared" ? transfer.toSupervisorId === employee.id : isProcessor(employee);

  if (["received", "not_received"].includes(toStatus)) {
    if (isOwner) return "You cannot confirm a transfer you created or that was sent for you";
    if (isReceiver) return null;
    return transfer.type === "shared"
      ? "Only the receiving supervisor can confirm these bags"
      : "Only L1/L2 can confirm bags returned to a company";
  }
  if (toStatus === "cancelled") {
    return isReceiver || isOwner ? null : "You cannot cancel this transfer";
  }
  return "You cannot perform this action";
}

/**
 * PUT /bag-transfers/:id/status
 * body: { status: "received" | "not_received" | "cancelled", note?, reason? }
 *
 * received      — deducts `bags` from the sender's allotment and, for 'shared',
 *                 adds them to the receiver's selected allotment
 * not_received  — no balance change; can later be marked received or cancelled
 * cancelled     — no balance change
 */
async function updateBagsTransferStatus(req, res, next) {
  try {
    const { status: toStatus, note, reason } = req.body;
    if (!toStatus) return error(res, 400, "status is required");

    await sequelize.transaction(async (t) => {
      const transfer = await BagsTransfer.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!transfer) throw httpError(404, "Bags transfer not found");

      const fromStatus = transfer.status;
      if (!(STATUS_FLOW[fromStatus] || []).includes(toStatus)) {
        throw httpError(409, `Cannot move a transfer from "${fromStatus}" to "${toStatus}"`);
      }
      const denied = authorizeTransition(transfer, toStatus, req.employee);
      if (denied) throw httpError(403, denied);

      const now = new Date();
      const updates = { status: toStatus };

      if (toStatus === "received") {
        const movements = [
          {
            supervisorId: transfer.senderId,
            allotmentVillageId: transfer.fromAllotmentVillageId,
            deltas: transfer.type === "return" ? { returnedBags: transfer.bags } : { sharedOutBags: transfer.bags },
          },
        ];
        if (transfer.type === "shared") {
          movements.push({
            supervisorId: transfer.toSupervisorId,
            allotmentVillageId: transfer.toAllotmentVillageId,
            deltas: { sharedInBags: transfer.bags },
          });
        }
        // Lock balance rows in a fixed order so opposite-direction transfers can't deadlock.
        movements.sort((a, b) => a.supervisorId - b.supervisorId || a.allotmentVillageId - b.allotmentVillageId);
        for (const m of movements) await applyBagMovement(m, t);

        Object.assign(updates, { receivedBy: req.employee.id, receivedAt: now });
      }

      if (toStatus === "cancelled") {
        Object.assign(updates, {
          cancelledBy: req.employee.id,
          cancelledAt: now,
          cancellationReason: reason || note || null,
        });
      }

      await transfer.update(updates, { transaction: t });
      await logStatus(transfer.id, fromStatus, toStatus, req.employee.id, transfer.bags, note || reason, t);
    });

    return success(res, 200, "Bags transfer status updated successfully", {
      data: decorate(await fetchFull(req.params.id), req.employee.id),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyBagsTransfers,
  getAllBagsTransfers,
  getBagsTransferById,
  getMyBagsTransferSummary,
  getBagsTransferSummary,
  getMyAllotmentsWithBags,
  getBagsBalance,
  getDestinationCompanies,
  getSupervisors,
  getSupervisorAllotments,
  createBagsTransfer,
  updateBagsTransfer,
  updateBagsTransferStatus,
};

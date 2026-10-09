"use strict";
const { Op } = require("sequelize");
const {
  sequelize,
  LoadingRequest,
  LoadingRequestEntry,
  AllotmentVillage,
  Village,
  Warehouse,
  SeedCompany,
  LogisticsPartner,
  Payment,
  Employee,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");
const { httpError } = require("../utils/bagsBalance");
const {
  EMP_ATTRS,
  allotmentVillageInclude,
  toPositiveInt,
} = require("../utils/bagsCommon");
const { createPaymentIfNeeded } = require("../utils/createPayment");
const { summarizeByStatus } = require("../utils/statusSummary");
const {
  isRequestOwner,
  assertRequestOwner,
  assertNotRequestOwner,
  resolveRequestOwner,
  creatorFlags,
} = require("../utils/requestOwnership");
const { attachPaymentContext } = require("../utils/paymentContext");
const { assertAllotmentOpen } = require("../utils/allotmentStatus");
const {
  calculateLoadingAmounts,
  requiredPaymentTypes,
  approvalStatus,
  PAYMENT_ID_FIELD,
} = require("../utils/loadingAmounts");
const {
  validateAmounts,
  validateCreatePayments,
  pickAmounts,
} = require("../validators/loadingRequestValidator");

const OPEN_STATUSES = ["pending", "verified", "partially_approved"];
const TRANSPORT_FIELDS = ["logisticsPartnerId", "rate", "marketsAmount", "kanttaBill"];
const HAMALI_FIELDS = ["hamaliAmount"];

// L3 never sees "partially_approved" — to them it is already approved.
const toSupervisorStatus = (status) => (status === "partially_approved" ? "approved" : status);
const fromSupervisorStatus = (status) =>
  status === "approved" ? ["approved", "partially_approved"] : status;

const PAYMENT_ATTRS = ["id", "paymentCode", "type", "status", "amount", "paymentDate"];

const HEADER_INCLUDES = [
  { model: Employee, as: "requester", attributes: EMP_ATTRS },
  { model: Employee, as: "creator", attributes: EMP_ATTRS },
  { model: Employee, as: "verifier", attributes: EMP_ATTRS },
  { model: Employee, as: "approver", attributes: EMP_ATTRS },
  { model: Employee, as: "canceller", attributes: EMP_ATTRS },
  { model: Village, as: "fromVillage", attributes: ["id", "name"] },
  {
    model: Warehouse,
    as: "toWarehouse",
    attributes: ["id", "warehouseId", "locationName"],
    include: { model: SeedCompany, as: "company", attributes: ["id", "name"] },
  },
  { model: LogisticsPartner, as: "logisticsPartner", attributes: ["id", "logisticsId", "name"] },
  { model: Payment, as: "transportPayment", attributes: PAYMENT_ATTRS },
  { model: Payment, as: "hamaliPayment", attributes: PAYMENT_ATTRS },
];

const ENTRY_INCLUDE = {
  model: LoadingRequestEntry,
  as: "cropEntries",
  separate: true, // own query, so it can't multiply parent rows / break pagination
  include: [
    allotmentVillageInclude("allotmentVillage"),
    { model: Employee, as: "supervisor", attributes: EMP_ATTRS },
  ],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Value to store for an uploaded file: S3 key (or local /uploads path).
const fileUrl = (file) => (file ? file.key : null);

/** { <prefix>Url, <prefix>Name } for an uploaded file, or {} when none was sent. */
const photoFields = (prefix, file) =>
  file ? { [`${prefix}Url`]: fileUrl(file), [`${prefix}Name`]: file.originalname } : {};

function parseEntries(raw) {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "cropEntries must be valid JSON");
  }
}

/**
 * Validates loading rows and attaches DK photos (url + original name).
 *
 * Which dk_photo file belongs to which row:
 *   - a row with dkPhotoIndex: N gets dk_photo[N] (use this whenever some
 *     rows have no photo — files are only sent for rows that have one)
 *   - if no row sends dkPhotoIndex, files map by position: entries[N] <-> dk_photo[N]
 * On edit, a row without a new file keeps its old photo by sending back its
 * existing dkPhotoUrl.
 */
async function buildEntries(rawEntries, requestedBy, dkFiles = [], existingEntries = []) {
  if (!Array.isArray(rawEntries) || !rawEntries.length) {
    throw httpError(400, "At least one loading row is required");
  }
  const explicitIndexes = rawEntries.some((e) => e.dkPhotoIndex !== undefined && e.dkPhotoIndex !== null);
  const existingByUrl = new Map(existingEntries.filter((e) => e.dkPhotoUrl).map((e) => [e.dkPhotoUrl, e]));
  const rows = [];
  for (const [index, entry] of rawEntries.entries()) {
    const row = `Loading ${index + 1}`;
    const allotmentVillageId = toPositiveInt(entry.allotmentVillageId);
    if (!allotmentVillageId) throw httpError(400, `${row}: allotment is required`);
    const noOfBags = toPositiveInt(entry.noOfBags);
    if (!noOfBags) throw httpError(400, `${row}: no. of bags must be a positive whole number`);
    const dkQuantity = Number(entry.dkQuantity);
    if (!(dkQuantity > 0)) throw httpError(400, `${row}: DK quantity must be greater than 0`);

    // "Self" (or nothing) = the requester; otherwise the selected supervisor.
    const supervisorId = toPositiveInt(entry.supervisorId) || requestedBy;
    const av = await AllotmentVillage.findByPk(allotmentVillageId);
    if (!av) throw httpError(404, `${row}: allotment not found`);
    if (av.supervisorId !== supervisorId) {
      throw httpError(400, `${row}: the allotment is not assigned to the selected supervisor`);
    }
    // Closed allotments can't be picked — unless this request (on edit) already has it.
    assertAllotmentOpen(av, row, existingEntries.map((e) => e.allotmentVillageId));

    const fileIndex = explicitIndexes ? entry.dkPhotoIndex : index;
    const file = fileIndex !== undefined && fileIndex !== null ? dkFiles[Number(fileIndex)] : undefined;
    if (explicitIndexes && fileIndex !== undefined && fileIndex !== null && !file) {
      throw httpError(400, `${row}: no dk_photo file at index ${fileIndex}`);
    }
    const kept = existingByUrl.get(entry.dkPhotoUrl); // edit: keep the old photo

    rows.push({
      allotmentVillageId,
      supervisorId,
      noOfBags,
      dkQuantity,
      // Keep the stored value (S3 key), not the resolved URL the client sent back.
      dkPhotoUrl: file ? fileUrl(file) : kept?.getDataValue?.("dkPhotoUrl") ?? kept?.dkPhotoUrl ?? null,
      dkPhotoName: file ? file.originalname : kept?.dkPhotoName || null,
    });
  }
  return rows;
}

async function validateLocations({ fromVillageId, toWarehouseId }) {
  if (fromVillageId !== undefined && !(await Village.findByPk(fromVillageId))) {
    throw httpError(404, "From village not found");
  }
  if (toWarehouseId && !(await Warehouse.findByPk(toWarehouseId))) {
    throw httpError(404, "To warehouse not found");
  }
}

/**
 * Applies amount edits. Transport fields lock once the Transport payment
 * exists, Hamali once the Hamali payment exists — a created payment's
 * amount can never drift from the request.
 */
async function applyAmounts(request, amounts, transaction) {
  const fields = Object.keys(amounts);
  if (!fields.length) return;
  if (request.transportPaymentId && fields.some((f) => TRANSPORT_FIELDS.includes(f))) {
    throw httpError(409, "Transport payment is already created — transport amounts can't be changed");
  }
  if (request.hamaliPaymentId && fields.some((f) => HAMALI_FIELDS.includes(f))) {
    throw httpError(409, "Hamali payment is already created — hamali amount can't be changed");
  }
  if (amounts.logisticsPartnerId && !(await LogisticsPartner.findByPk(amounts.logisticsPartnerId, { transaction }))) {
    throw httpError(404, "Transport (logistics partner) not found");
  }
  await request.update(amounts, { transaction });
}

/* ------------------------------------------------------------------ */
/* Who sees what                                                       */
/* ------------------------------------------------------------------ */
//
// A loading request belongs to the supervisor who raised it (requestedBy /
// createdBy). Its rows can also be for OTHER supervisors' allotments
// (LoadingRequestEntry.supervisorId). Those supervisors see the request in
// their "my requests" too, but view only — they can't edit, cancel, verify,
// change amounts or create payments.

/** where: requests raised for me, created by me for a supervisor, or where at least one loading row is mine. */
function myRequestsWhere(employeeId) {
  const id = sequelize.escape(employeeId);
  return {
    [Op.or]: [
      { requestedBy: employeeId },
      { createdBy: employeeId },
      {
        id: {
          [Op.in]: sequelize.literal(
            `(SELECT loadingRequestId FROM \`LoadingRequestEntries\` WHERE supervisorId = ${id})`,
          ),
        },
      },
    ],
  };
}

/** True when the employee only appears as a row supervisor (not the owner). */
function isViewOnlyFor(json, employeeId) {
  if (json.requestedBy === employeeId || json.createdBy === employeeId) return false;
  return (json.cropEntries || []).some((e) => e.supervisorId === employeeId);
}

/** Blocks every action for a supervisor who only appears on a row of this request. */
async function assertNotViewOnly(request, employee, transaction) {
  if (isRequestOwner(request, employee)) return;
  const myRows = await LoadingRequestEntry.count({
    where: { loadingRequestId: request.id, supervisorId: employee.id },
    transaction,
  });
  if (myRows) {
    throw httpError(403, "This request includes your allotment, but it was raised by another supervisor — you can only view it");
  }
}

/**
 * Adds totals, the transport/hamali payment state and (for L3) the collapsed
 * status. With viewerId, also adds viewOnly: true when that employee only
 * appears as a row supervisor (the UI hides all actions).
 */
function decorate(request, { forSupervisor = false, viewerId = null } = {}) {
  const json = request.toJSON();
  const amounts = calculateLoadingAmounts(json, json.cropEntries || []);
  const required = requiredPaymentTypes(json, amounts);
  const paymentState = (type, amount) => ({
    required: required.includes(type),
    amount,
    created: Boolean(json[PAYMENT_ID_FIELD[type]]),
    payment: json[`${type}Payment`] || null,
  });

  return {
    ...json,
    status: forSupervisor ? toSupervisorStatus(json.status) : json.status,
    ...(viewerId && { viewOnly: isViewOnlyFor(json, viewerId) }),
    // createdByMe / createdOnBehalf / canEdit — only the creator edits, while pending
    ...(viewerId && creatorFlags(json, viewerId)),
    amounts,
    payments: {
      transport: paymentState("transport", amounts.transportAmount),
      hamali: paymentState("hamali", amounts.hamaliAmount),
    },
  };
}

async function fetchFull(id, transaction) {
  return LoadingRequest.findByPk(id, {
    include: [...HEADER_INCLUDES, ENTRY_INCLUDE],
    transaction,
  });
}

const respond = async (res, status, message, id, options) =>
  success(res, status, message, { data: decorate(await fetchFull(id), options) });

/* ------------------------------------------------------------------ */
/* Lists & summary                                                     */
/* ------------------------------------------------------------------ */

async function listLoadingRequests(baseWhere, req, res, next, { forSupervisor = false } = {}) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, villageId, search } = req.query;

    const where = { ...baseWhere };
    if (status) where.status = forSupervisor ? fromSupervisorStatus(status) : status;
    if (villageId) where.fromVillageId = villageId;
    if (search) where.requestCode = { [Op.like]: `%${search}%` };

    const result = await LoadingRequest.findAndCountAll({
      where,
      include: [...HEADER_INCLUDES, ENTRY_INCLUDE],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const response = buildPaginatedResponse(result, page, limit);
    response.data = result.rows.map((r) => decorate(r, { forSupervisor, viewerId: req.employee.id }));
    return success(res, 200, "Loading requests fetched successfully", response);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /loading-requests/my-requests — L3: requests I raised + requests where a
 * loading row is for my allotment (those come back with viewOnly: true).
 * Partially approved is shown as approved.
 */
async function getMyLoadingRequests(req, res, next) {
  return listLoadingRequests(myRequestsWhere(req.employee.id), req, res, next, { forSupervisor: true });
}

/** GET /loading-requests — L2 verification / L1 approval list */
async function getAllLoadingRequests(req, res, next) {
  const where = {};
  if (req.query.requestedBy) where.requestedBy = req.query.requestedBy;
  return listLoadingRequests(where, req, res, next);
}

const LOADING_STATUSES = ["pending", "verified", "partially_approved", "approved", "cancelled"];

/** GET /loading-requests/my-summary — L3 cards: Pending | Verified | Approved | Canceled (+ total) */
async function getMyLoadingSummary(req, res, next) {
  try {
    // Same set as my-requests: raised by me + ones with a row for my allotment.
    const c = await summarizeByStatus(LoadingRequest, LOADING_STATUSES, myRequestsWhere(req.employee.id));
    return success(res, 200, "Loading summary fetched successfully", {
      data: {
        total: c.total,
        pending: c.pending,
        verified: c.verified,
        approved: c.approved + c.partiallyApproved, // L3 never sees partially approved separately
        cancelled: c.cancelled,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /loading-requests/summary — Verifications / Approvals cards, including partially approved (+ total) */
async function getLoadingSummary(req, res, next) {
  try {
    const data = await summarizeByStatus(LoadingRequest, LOADING_STATUSES);
    return success(res, 200, "Loading summary fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

/** GET /loading-requests/:id */
async function getLoadingRequestById(req, res, next) {
  try {
    const request = await fetchFull(req.params.id);
    if (!request) return error(res, 404, "Loading request not found");
    const json = request.toJSON();
    // Supervisors (owner or row supervisor) see the collapsed L3 statuses.
    const isSupervisorView = isRequestOwner(request, req.employee) || isViewOnlyFor(json, req.employee.id);
    return success(res, 200, "Loading request fetched successfully", {
      data: decorate(request, { forSupervisor: isSupervisorView, viewerId: req.employee.id }),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /loading-requests/:id/payments — the Transport / Hamali payments created for this request */
async function getLoadingRequestPayments(req, res, next) {
  try {
    const request = await LoadingRequest.findByPk(req.params.id, { attributes: ["id"] });
    if (!request) return error(res, 404, "Loading request not found");

    const payments = await Payment.findAll({
      where: { sourceRequestType: "loading_request", sourceRequestId: request.id },
      include: [
        { model: Employee, as: "creator", attributes: EMP_ATTRS },
        { model: Employee, as: "processor", attributes: EMP_ATTRS },
      ],
      order: [["createdAt", "ASC"]],
    });
    return success(res, 200, "Loading payments fetched successfully", {
      data: await attachPaymentContext(payments),
    });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Create / Edit                                                       */
/* ------------------------------------------------------------------ */

/**
 * POST /loading-requests (multipart/form-data)
 * Raised by a supervisor, or on a supervisor's behalf (e.g. from
 * Verifications) by passing requestedBy = that supervisor's id.
 * fields: fromVillageId, toWarehouseId?, transporterName?, hamaliGangName?, note?, requestedBy?,
 *         cropEntries (JSON): [{ allotmentVillageId, supervisorId?, noOfBags, dkQuantity, dkPhotoIndex? }]
 * files:  start_photo, end_photo, dk_photo (repeat once per row that has a photo;
 *         dkPhotoIndex = that file's position among the dk_photo files)
 * Each photo's original file name is stored next to its URL.
 */
async function createLoadingRequest(req, res, next) {
  try {
    const { fromVillageId, toWarehouseId, transporterName, hamaliGangName, note, requestedBy: onBehalfOf } = req.body;
    if (!fromVillageId) return error(res, 400, "fromVillageId is required");

    // Defaults to the caller; pass requestedBy to raise it for another supervisor.
    const requestedBy = await resolveRequestOwner(onBehalfOf, req.employee);
    await validateLocations({ fromVillageId, toWarehouseId });
    const entries = await buildEntries(parseEntries(req.body.cropEntries ?? req.body.entries), requestedBy, req.files?.dk_photo);
    const id = await sequelize.transaction(async (t) => {
      const created = await LoadingRequest.create(
        {
          requestedBy,
          createdBy: req.employee.id,
          fromVillageId,
          toWarehouseId: toWarehouseId || null,
          transporterName: transporterName || null,
          hamaliGangName: hamaliGangName || null,
          note: note || null,
          ...photoFields("startPhoto", req.files?.start_photo?.[0]),
          ...photoFields("endPhoto", req.files?.end_photo?.[0]),
          status: "pending",
        },
        { transaction: t },
      );
      await created.update({ requestCode: generateId("LD", created.id) }, { transaction: t });
      await LoadingRequestEntry.bulkCreate(
        entries.map((e) => ({ ...e, loadingRequestId: created.id })),
        { transaction: t },
      );
      return created.id;
    });

    return respond(res, 201, "Loading request created successfully", id, { forSupervisor: true });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /loading-requests/:id (multipart/form-data) — only by the person who
 * raised/created it, and only while Pending.
 * Same fields as create, all optional. entries, if sent, REPLACES all rows.
 */
async function updateLoadingRequest(req, res, next) {
  try {
    const request = await LoadingRequest.findByPk(req.params.id, { include: ENTRY_INCLUDE });
    if (!request) return error(res, 404, "Loading request not found");
    assertRequestOwner(request, req.employee);
    if (request.status !== "pending") {
      return error(res, 409, "Loading requests can only be edited while Pending");
    }

    const { fromVillageId, toWarehouseId, transporterName, hamaliGangName, note } = req.body;
    await validateLocations({ fromVillageId, toWarehouseId });

    const rawEntries = parseEntries(req.body.cropEntries ?? req.body.entries);
    const entries =
      rawEntries !== undefined
        ? await buildEntries(
            rawEntries,
            request.requestedBy,
            req.files?.dk_photo,
            request.cropEntries,
          )
        : undefined;

    await sequelize.transaction(async (t) => {
      await request.update(
        {
          ...(fromVillageId !== undefined && { fromVillageId }),
          ...(toWarehouseId !== undefined && { toWarehouseId: toWarehouseId || null }),
          ...(transporterName !== undefined && { transporterName }),
          ...(hamaliGangName !== undefined && { hamaliGangName }),
          ...(note !== undefined && { note }),
          ...photoFields("startPhoto", req.files?.start_photo?.[0]), // a new file replaces the old one
          ...photoFields("endPhoto", req.files?.end_photo?.[0]),
        },
        { transaction: t },
      );
      if (entries) {
        await LoadingRequestEntry.destroy({ where: { loadingRequestId: request.id }, transaction: t });
        await LoadingRequestEntry.bulkCreate(
          entries.map((e) => ({ ...e, loadingRequestId: request.id })),
          { transaction: t },
        );
      }
    });

    return respond(res, 200, "Loading request updated successfully", request.id, { forSupervisor: true });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Verification / amounts / cancel (L2, L1)                            */
/* ------------------------------------------------------------------ */

/** Loads the request locked for update inside a transaction, or throws 404. */
async function lockRequest(id, t) {
  const request = await LoadingRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!request) throw httpError(404, "Loading request not found");
  return request;
}

/** Recomputes approved / partially_approved after amounts change on a partially approved request. */
async function syncApprovalStatus(request, t) {
  if (request.status !== "partially_approved") return;
  const entries = await LoadingRequestEntry.findAll({ where: { loadingRequestId: request.id }, transaction: t });
  const status = approvalStatus(request, calculateLoadingAmounts(request, entries));
  if (status && status !== request.status) await request.update({ status }, { transaction: t });
}

/**
 * PUT /loading-requests/:id/amounts — L2/L1 update Transport name, Rate,
 * Markets, Hamali amount, Kantta bill on an open request.
 */
async function updateLoadingAmounts(req, res, next) {
  try {
    const { data, message } = validateAmounts(req.body);
    if (message) return error(res, 400, message);

    await sequelize.transaction(async (t) => {
      const request = await lockRequest(req.params.id, t);
      await assertNotViewOnly(request, req.employee, t); // row supervisors can only view
      if (!OPEN_STATUSES.includes(request.status)) {
        throw httpError(409, `Amounts can't be changed on a ${request.status} request`);
      }
      await applyAmounts(request, pickAmounts(data), t);
      await syncApprovalStatus(request, t);
    });

    return respond(res, 200, "Loading amounts updated successfully", req.params.id);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /loading-requests/:id/verify — L2 (or L1). Pending -> Verified.
 * body: optional amounts. Verifying without a rate is allowed.
 */
async function verifyLoadingRequest(req, res, next) {
  try {
    const { data, message } = validateAmounts(req.body);
    if (message) return error(res, 400, message);

    await sequelize.transaction(async (t) => {
      const request = await lockRequest(req.params.id, t);
      await assertNotViewOnly(request, req.employee, t); // row supervisors can only view
      assertNotRequestOwner(request, req.employee, "verify");
      if (request.status !== "pending") {
        throw httpError(409, `Cannot verify a request with status "${request.status}"`);
      }
      await applyAmounts(request, pickAmounts(data), t);
      await request.update(
        { status: "verified", verifiedBy: req.employee.id, verifiedAt: new Date() },
        { transaction: t },
      );
    });

    return respond(res, 200, "Loading request verified successfully", req.params.id);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /loading-requests/:id/cancel — body: { reason? }
 * Allowed while Pending or Verified — not once any payment exists.
 */
async function cancelLoadingRequest(req, res, next) {
  try {
    await sequelize.transaction(async (t) => {
      const request = await lockRequest(req.params.id, t);
      await assertNotViewOnly(request, req.employee, t); // row supervisors can only view
      if (!["pending", "verified"].includes(request.status)) {
        throw httpError(409, `Cannot cancel a request with status "${request.status}"`);
      }
      await request.update(
        {
          status: "cancelled",
          cancelledBy: req.employee.id,
          cancelledAt: new Date(),
          cancellationReason: req.body?.reason || null,
        },
        { transaction: t },
      );
    });

    return respond(res, 200, "Loading request cancelled", req.params.id);
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* Payments (L1)                                                       */
/* ------------------------------------------------------------------ */

/** Builds the Payment row for one type, or throws why it can't be created. */
async function buildLoadingPayment(type, request, amounts, approverId, t) {
  const base = {
    sourceRequestType: "loading_request",
    sourceRequestId: request.id,
    createdBy: approverId,
  };

  if (type === "transport") {
    if (!request.logisticsPartnerId) throw httpError(400, "Select the transport before creating the Transport payment");
    if (!(amounts.transportAmount > 0)) throw httpError(400, "Transport amount must be greater than 0");
    const partner = await LogisticsPartner.findByPk(request.logisticsPartnerId, { transaction: t });
    return {
      ...base,
      type: "transport",
      recipientType: "logistics_partner",
      recipientId: request.logisticsPartnerId,
      recipientName: partner?.name || request.transporterName,
      amount: amounts.transportAmount,
    };
  }

  if (!request.hamaliGangName) throw httpError(400, "Hamali gang name is missing on this request");
  if (!(amounts.hamaliAmount > 0)) throw httpError(400, "Hamali amount must be greater than 0");
  return {
    ...base,
    type: "hamali",
    recipientType: "hamali_group",
    recipientName: request.hamaliGangName,
    amount: amounts.hamaliAmount,
  };
}

/**
 * POST /loading-requests/:id/payments — L1.
 * body: { paymentTypes: ["transport"] | ["hamali"] | ["transport", "hamali"], ...optional amounts }
 *
 * Creates each requested payment that doesn't exist yet (existing ones are
 * skipped, never duplicated). Status becomes partially_approved while a
 * required payment is still missing, approved once all exist.
 */
async function createLoadingPayments(req, res, next) {
  try {
    const { data, message } = validateCreatePayments(req.body);
    if (message) return error(res, 400, message);

    const result = await sequelize.transaction(async (t) => {
      const request = await lockRequest(req.params.id, t);
      await assertNotViewOnly(request, req.employee, t); // row supervisors can only view
      assertNotRequestOwner(request, req.employee, "approve");
      if (request.status === "approved") throw httpError(409, "All payments for this request are already created");
      if (!OPEN_STATUSES.includes(request.status)) {
        throw httpError(409, `Cannot create payments for a ${request.status} request`);
      }

      await applyAmounts(request, pickAmounts(data), t);
      const entries = await LoadingRequestEntry.findAll({ where: { loadingRequestId: request.id }, transaction: t });
      const amounts = calculateLoadingAmounts(request, entries);

      const types = [...new Set(data.paymentTypes)];
      const skipped = types.filter((type) => request[PAYMENT_ID_FIELD[type]]);
      const toCreate = types.filter((type) => !request[PAYMENT_ID_FIELD[type]]);
      if (!toCreate.length) throw httpError(409, `The ${skipped.join(" and ")} payment is already created`);

      const created = [];
      for (const type of toCreate) {
        const row = await buildLoadingPayment(type, request, amounts, req.employee.id, t);
        const payment = await createPaymentIfNeeded(row, { transaction: t });
        request[PAYMENT_ID_FIELD[type]] = payment.id;
        created.push(type);
      }

      await request.update(
        {
          transportPaymentId: request.transportPaymentId,
          hamaliPaymentId: request.hamaliPaymentId,
          status: approvalStatus(request, amounts),
          approvedBy: request.approvedBy || req.employee.id,
          approvedAt: request.approvedAt || new Date(),
        },
        { transaction: t },
      );
      return { created, skipped };
    });

    const request = decorate(await fetchFull(req.params.id));
    return success(
      res,
      201,
      request.status === "approved"
        ? "Payments created — loading request approved"
        : "Payment created — loading request partially approved",
      { data: request, ...result },
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /loading-requests/warehouses?search= — "To location (warehouse)" dropdown.
 * Returns [{ id, warehouseId, locationName }].
 */
async function getLoadingWarehouses(req, res, next) {
  try {
    const where = {};
    if (req.query.search) {
      const term = `%${req.query.search.trim()}%`;
      where[Op.or] = [{ locationName: { [Op.like]: term } }, { warehouseId: { [Op.like]: term } }];
    }
    const data = await Warehouse.findAll({
      where,
      attributes: ["id", "warehouseId", "locationName"],
      order: [["locationName", "ASC"]],
    });
    return success(res, 200, "Warehouses fetched successfully", { data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLoadingWarehouses,
  getMyLoadingRequests,
  getAllLoadingRequests,
  getMyLoadingSummary,
  getLoadingSummary,
  getLoadingRequestById,
  getLoadingRequestPayments,
  createLoadingRequest,
  updateLoadingRequest,
  updateLoadingAmounts,
  verifyLoadingRequest,
  cancelLoadingRequest,
  createLoadingPayments,
};

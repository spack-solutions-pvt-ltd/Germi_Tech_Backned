"use strict";
const { Op } = require("sequelize");
const {
  Allotment,
  AllotmentVillage,
  CompanyCrop,
  Crop,
  Village,
  Employee,
  LabourRequest,
  LabourRequestCropEntry,
  ExpenseRequest,
  VehicleRequest,
  LoadingRequest,
  LoadingRequestEntry,
  BagsRequest,
  BagsRequestCropEntry,
  Payment,
  Task,
  TaskType,
  Notification,
} = require("../models");
const { success, error } = require("../utils/response");
const { allotmentVillageInclude, EMP_ATTRS } = require("../utils/bagsCommon");
const { allotmentScope, resolveSeason } = require("../utils/periods");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");

const OPEN_TASK_STATUSES = ["Pending", "Approval", "Reassigned", "Overdue"];


const tableLimit = (query) => Math.min(Math.max(parseInt(query.limit, 10) || 6, 1), 20);
const toNumber = (value) => Number(value) || 0;
const person = (emp) => (emp ? { id: emp.id, name: emp.name, level: emp.level } : null);

/** Allotment filter: a given season (?season=&year=), or every open allotment. */
const allotmentWhere = (query) => allotmentScope(query).where;

/** "Paddy · NS-Sona 214" and village name for one AllotmentVillage. */
function describeAllotmentVillage(av) {
  const crop = av?.allotment?.companyCrop?.crop?.name;
  const variety = av?.allotment?.companyCrop?.varietyName;
  return {
    cropVariety: crop ? [crop, variety].filter(Boolean).join(" · ") : null,
    village: av?.village?.name || null,
  };
}

/** First row's crop/village, with "+N" when a request covers several allotments. */
function describeEntries(entries = []) {
  if (!entries.length) return { cropVariety: null, village: null };
  const first = describeAllotmentVillage(entries[0].allotmentVillage);
  const extra = entries.length > 1 ? ` +${entries.length - 1}` : "";
  return { cropVariety: first.cropVariety ? first.cropVariety + extra : null, village: first.village };
}

const BANNER_NOTIFICATIONS = 3;

/** Newest notifications for this employee's level (or "All") — the banner. */
async function latestNotifications(employee) {
  const rows = await Notification.findAll({
    where: { toLevel: { [Op.in]: [employee.level, "All"] } },
    include: [{ model: Employee, as: "sender", attributes: EMP_ATTRS }],
    order: [["createdAt", "DESC"]],
    limit: BANNER_NOTIFICATIONS,
  });
  return rows.map((n) => ({
    id: n.id,
    notificationId: n.notificationId,
    message: n.message,
    toLevel: n.toLevel,
    imageUrl: n.imageUrl,
    documentUrl: n.documentUrl,
    documentName: n.documentName,
    createdAt: n.createdAt,
    sender: person(n.sender),
  }));
}

/* Request sources (one per request type) for the "pending" tables  */

const entriesInclude = (model) => ({
  model,
  as: "cropEntries",
  separate: true,
  include: allotmentVillageInclude("allotmentVillage"),
});

const REQUEST_SOURCES = {
  labour: {
    label: "Labour",
    model: LabourRequest,
    include: [
      { model: Employee, as: "requester", attributes: EMP_ATTRS },
      { model: Employee, as: "verifier", attributes: EMP_ATTRS },
      entriesInclude(LabourRequestCropEntry),
    ],
    describe: (r) => ({ ...describeEntries(r.cropEntries), verifiedBy: person(r.verifier) }),
  },
  expense: {
    label: "Expenses",
    model: ExpenseRequest,
    include: [
      { model: Employee, as: "requester", attributes: EMP_ATTRS },
      { model: Employee, as: "verifier", attributes: EMP_ATTRS },
    ],
    describe: (r) => ({ cropVariety: null, village: null, verifiedBy: person(r.verifier), amount: r.amount }),
  },
  vehicle: {
    label: "Vehicle",
    model: VehicleRequest,
    include: [
      { model: Employee, as: "requester", attributes: EMP_ATTRS },
      { model: Employee, as: "assigner", attributes: EMP_ATTRS },
      allotmentVillageInclude("allotmentVillage"),
    ],
    describe: (r) => ({ ...describeAllotmentVillage(r.allotmentVillage), verifiedBy: person(r.assigner) }),
  },
  loading: {
    label: "Loading",
    model: LoadingRequest,
    include: [
      { model: Employee, as: "requester", attributes: EMP_ATTRS },
      { model: Employee, as: "verifier", attributes: EMP_ATTRS },
      { model: Village, as: "fromVillage", attributes: ["id", "name"] },
      entriesInclude(LoadingRequestEntry),
    ],
    describe: (r) => {
      const d = describeEntries(r.cropEntries);
      return { ...d, village: r.fromVillage?.name || d.village, verifiedBy: person(r.verifier) };
    },
  },
  bags: {
    label: "Bags",
    model: BagsRequest,
    include: [
      { model: Employee, as: "requester", attributes: EMP_ATTRS },
      entriesInclude(BagsRequestCropEntry),
    ],
    describe: (r) => ({ ...describeEntries(r.cropEntries), verifiedBy: null }),
  },
};

/**
 * Counts + the newest rows across several request types.
 * statusByType: { labour: "verified", vehicle: ["pending", "in_process"], ... }
 * Returns { total, byType: { labour: n, ... }, rows: [...] } (rows newest first).
 */
async function pendingRequests(statusByType, limit) {
  const types = Object.keys(statusByType);

  const results = await Promise.all(
    types.map(async (type) => {
      const source = REQUEST_SOURCES[type];
      const where = { status: statusByType[type] };
      const [count, records] = await Promise.all([
        source.model.count({ where }),
        source.model.findAll({ where, include: source.include, order: [["createdAt", "DESC"]], limit }),
      ]);
      const rows = records.map((r) => ({
        id: r.id,
        type,
        typeLabel: source.label,
        requestCode: r.requestCode,
        status: r.status,
        createdAt: r.createdAt,
        requestedBy: person(r.requester),
        ...source.describe(r),
      }));
      return { type, count, rows };
    }),
  );

  return {
    total: results.reduce((sum, r) => sum + r.count, 0),
    byType: Object.fromEntries(results.map((r) => [r.type, r.count])),
    rows: results
      .flatMap((r) => r.rows)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit),
  };
}

/** Open tasks assigned to an employee: { count, rows }. */
async function openTasks(employeeId, limit) {
  const where = { assignedTo: employeeId, status: OPEN_TASK_STATUSES };
  const [count, tasks] = await Promise.all([
    Task.count({ where }),
    Task.findAll({
      where,
      include: [
        { model: TaskType, as: "taskType", attributes: ["id", "name"] },
        { model: Employee, as: "assignedByEmployee", attributes: EMP_ATTRS },
      ],
      order: [["dueDate", "ASC"]],
      limit,
    }),
  ]);
  return {
    count,
    rows: tasks.map((t) => ({
      id: t.id,
      taskId: t.taskId,
      assignedDate: t.assignedDate || t.createdAt,
      type: t.taskType?.name || null,
      dueDate: t.dueDate,
      status: t.status,
      assignedBy: person(t.assignedByEmployee),
    })),
  };
}

/** Pending payments: { count, amount }. */
async function pendingPayments() {
  const where = { status: "pending" };
  const [count, amount] = await Promise.all([Payment.count({ where }), Payment.sum("amount", { where })]);
  return { count, amount: toNumber(amount) };
}

/** Allotment-villages (optionally one supervisor's) with village + crop, inside the allotment filter. */
function findAllotmentVillages(query, extraWhere = {}) {
  return AllotmentVillage.findAll({
    where: extraWhere,
    include: [
      { model: Village, as: "village", attributes: ["id", "name"] },
      {
        model: Allotment,
        as: "allotment",
        attributes: ["id", "allotmentId", "season", "year", "status"],
        where: allotmentWhere(query),
        include: {
          model: CompanyCrop,
          as: "companyCrop",
          attributes: ["id", "cropId", "varietyName"],
          include: { model: Crop, as: "crop", attributes: ["id", "name"] },
        },
      },
    ],
    order: [["createdAt", "DESC"]],
  });
}

/** Season label for the cards ("Rabi 2026", or "Open allotments"). */
const scopeLabel = (query) => allotmentScope(query).label;

/* L1 — Owner dashboard */
const L1_APPROVAL_STATUSES = {
  labour: "verified",
  expense: "verified",
  vehicle: ["pending", "in_process"],
  loading: ["pending", "verified", "partially_approved"],
};

async function getL1Dashboard(req, res, next) {
  try {
    const limit = tableLimit(req.query);
    const [notifications, allotmentVillages, approvals, activeAllotments, payments] = await Promise.all([
      latestNotifications(req.employee),
      findAllotmentVillages(req.query),
      pendingRequests(L1_APPROVAL_STATUSES, limit),
      // Allotments in scope that already have standing acres on the ground.
      Allotment.count({
        where: allotmentWhere(req.query),
        include: [
          { model: AllotmentVillage, as: "villageAllotments", attributes: [], where: { standingAcres: { [Op.gt]: 0 } } },
        ],
        distinct: true,
      }),
      pendingPayments(),
    ]);

    // Acres by crop (bars) + total acres allotted.
    const byCrop = new Map();
    for (const av of allotmentVillages) {
      const crop = av.allotment?.companyCrop?.crop?.name || "Unknown";
      byCrop.set(crop, (byCrop.get(crop) || 0) + toNumber(av.allottedAcres));
    }
    const acresByCrop = [...byCrop.entries()]
      .map(([crop, acres]) => ({ crop, acres }))
      .sort((a, b) => b.acres - a.acres);

    return success(res, 200, "L1 dashboard fetched successfully", {
      data: {
        notifications,
        scope: scopeLabel(req.query),
        cards: {
          totalAcresAllotted: acresByCrop.reduce((sum, c) => sum + c.acres, 0),
          pendingApprovals: approvals.total,
          pendingApprovalsByType: approvals.byType,
          activeAllotments,
          paymentsDue: payments.amount,
          pendingPaymentsCount: payments.count,
        },
        pendingApprovals: approvals.rows,
        acresByCrop,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* L2 — Staff dashboard*/

const L2_VERIFICATION_STATUSES = {
  labour: "pending",
  expense: "pending",
  vehicle: "pending",
  loading: "pending",
  bags: "pending",
};

async function getL2Dashboard(req, res, next) {
  try {
    const limit = tableLimit(req.query);
    const [notifications, tasks, verifications, payments] = await Promise.all([
      latestNotifications(req.employee),
      openTasks(req.employee.id, limit),
      pendingRequests(L2_VERIFICATION_STATUSES, limit),
      pendingPayments(),
    ]);

    return success(res, 200, "L2 dashboard fetched successfully", {
      data: {
        notifications,
        cards: {
          pendingTasks: tasks.count,
          pendingVerifications: verifications.total,
          pendingVerificationsByType: verifications.byType,
          pendingPayments: payments.count,
          paymentsDue: payments.amount,
        },
        pendingVerifications: verifications.rows,
        pendingTasks: tasks.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* L3 — Supervisor dashboard*/

async function rowingAcres(allotmentVillageIds) {
  if (!allotmentVillageIds.length) return new Map();
  const entries = await LabourRequestCropEntry.findAll({
    where: { allotmentVillageId: allotmentVillageIds, rowingTime: { [Op.ne]: null } },
    attributes: ["allotmentVillageId", "rowingTime", "acresWorked"],
    include: [{ model: LabourRequest, as: "labourRequest", attributes: [], where: { status: { [Op.ne]: "rejected" } } }],
  });

  const totals = new Map(); // avId -> { "1st": n, "2nd": n, "3rd": n }
  for (const e of entries) {
    const row = totals.get(e.allotmentVillageId) || { "1st": 0, "2nd": 0, "3rd": 0 };
    row[e.rowingTime] += toNumber(e.acresWorked);
    totals.set(e.allotmentVillageId, row);
  }
  return totals;
}

/**
 * Which allotments an L3 supervisor sees on the dashboard: their village
 * allotments in THIS season (?season=&year= to change) whose village allotment
 * status is open (?status=closed to change). Shared by the cards and the list,
 * so their numbers always match.
 */
function l3AllotmentQuery(req) {
  const season = resolveSeason(req.query);
  const status = ["open", "closed"].includes(req.query.status) ? req.query.status : "open";
  return {
    label: `${season.label} · ${status}`,
    options: {
      where: { supervisorId: req.employee.id, status },
      include: [
        { model: Village, as: "village", attributes: ["id", "name"] },
        {
          model: Allotment,
          as: "allotment",
          attributes: ["id", "allotmentId", "season", "year", "status"],
          where: { season: season.season, year: season.year },
          include: {
            model: CompanyCrop,
            as: "companyCrop",
            attributes: ["id", "cropId", "varietyName"],
            include: { model: Crop, as: "crop", attributes: ["id", "name"] },
          },
        },
      ],
    },
  };
}

/** GET /dashboard/l3 — cards, banner and pending tasks (allotments list: /dashboard/l3/allotments). */
async function getL3Dashboard(req, res, next) {
  try {
    const limit = tableLimit(req.query);
    const scope = l3AllotmentQuery(req);
    const [notifications, tasks, allotmentVillages] = await Promise.all([
      latestNotifications(req.employee),
      openTasks(req.employee.id, limit),
      AllotmentVillage.findAll(scope.options),
    ]);

    return success(res, 200, "L3 dashboard fetched successfully", {
      data: {
        notifications,
        scope: scope.label,
        cards: {
          pendingTasks: tasks.count,
          allottedVillages: new Set(allotmentVillages.map((av) => av.villageId)).size,
          allottedAcres: allotmentVillages.reduce((sum, av) => sum + toNumber(av.allottedAcres), 0),
          allottedCrops: new Set(allotmentVillages.map((av) => av.allotment?.companyCrop?.cropId)).size,
          allottedVarieties: new Set(allotmentVillages.map((av) => av.allotment?.companyCrop?.id)).size,
        },
        pendingTasks: tasks.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /dashboard/l3/allotments?page=&limit=&season=&year=&status=
 * "My allotments" table for the logged-in supervisor, paginated, with
 * standing and rowing (1st / 2nd / 3rd) acres per village allotment.
 */
async function getL3Allotments(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const scope = l3AllotmentQuery(req);

    const result = await AllotmentVillage.findAndCountAll({
      ...scope.options,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });
    const rowing = await rowingAcres(result.rows.map((av) => av.id));

    const response = buildPaginatedResponse(result, page, limit);
    response.data = result.rows.map((av) => {
      const stages = rowing.get(av.id) || { "1st": 0, "2nd": 0, "3rd": 0 };
      return {
        allotmentVillageId: av.id,
        allotmentId: av.allotment?.allotmentId,
        ...describeAllotmentVillage(av),
        season: av.allotment ? `${av.allotment.season} ${av.allotment.year}` : null,
        status: av.status,
        allottedAcres: toNumber(av.allottedAcres),
        standingAcres: toNumber(av.standingAcres),
        rowing1Acres: stages["1st"],
        rowing2Acres: stages["2nd"],
        rowing3Acres: stages["3rd"],
      };
    });
    response.scope = scope.label;

    return success(res, 200, "My allotments fetched successfully", response);
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ */
/* GET /dashboard — by the logged-in user's level                      */
/* ------------------------------------------------------------------ */

const DASHBOARD_BY_LEVEL = { L1: getL1Dashboard, L2: getL2Dashboard, L3: getL3Dashboard };

function getMyDashboard(req, res, next) {
  const handler = DASHBOARD_BY_LEVEL[req.employee.level];
  if (!handler) return error(res, 400, `No dashboard for level ${req.employee.level}`);
  return handler(req, res, next);
}

module.exports = { getMyDashboard, getL1Dashboard, getL2Dashboard, getL3Dashboard, getL3Allotments };

"use strict";
const {
  VehicleRequest,
  AllotmentVillage,
  Allotment,
  CompanyCrop,
  Crop,
  Village,
  Warehouse,
  LogisticsPartner,
  Vehicle,
  Employee,
} = require("../models");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");

const INCLUDES = [
  { model: Employee, as: "requester", attributes: ["id", "empId", "name", "level"] },
  { model: Employee, as: "creator", attributes: ["id", "empId", "name", "level"] },
  { model: Employee, as: "assigner", attributes: ["id", "empId", "name"] },
  {
    model: AllotmentVillage,
    as: "allotmentVillage",
    include: [
      { model: Village, as: "village", attributes: ["id", "name"] },
      {
        model: Allotment,
        as: "allotment",
        attributes: ["id", "allotmentCode", "companyId"],
        include: {
          model: CompanyCrop,
          as: "companyCrop",
          attributes: ["id", "varietyName"],
          include: { model: Crop, as: "crop", attributes: ["id", "name"] },
        },
      },
    ],
  },
  { model: Warehouse, as: "toWarehouse", attributes: ["id", "locationName"] },
  { model: LogisticsPartner, as: "logisticsPartner", attributes: ["id", "name"] },
  { model: Vehicle, as: "vehicle", attributes: ["id", "regNo", "driverName", "driverNumber"] },
];

/** Shared list logic — `where` is built by the caller so "mine" vs "everyone's" can differ. */
async function listVehicleRequests(where, req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, village } = req.query;
    if (status) where.status = status;

    const include = INCLUDES;
    // "village" filter needs to reach through allotmentVillage -> village,
    // so it's applied as a nested where rather than a top-level column.
    const includeWithVillageFilter = village
      ? include.map((inc) =>
          inc.as === "allotmentVillage"
            ? { ...inc, include: inc.include.map((i) => (i.as === "village" ? { ...i, where: { name: village } } : i)) }
            : inc
        )
      : include;

    const result = await VehicleRequest.findAndCountAll({
      where,
      include: includeWithVillageFilter,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(res, 200, "Vehicle requests fetched successfully", buildPaginatedResponse(result, page, limit));
  } catch (err) {
    next(err);
  }
}

/** GET /api/vehicle-requests/my-requests — the L3 "Requests" tab: own requests only */
async function getMyVehicleRequests(req, res, next) {
  if (!req.employee) return error(res, 401, "Authentication required");
  return listVehicleRequests({ requestedBy: req.employee.id }, req, res, next);
}

/** GET /api/vehicle-requests — Verifications (L2, view-only) / Approvals (L1): every supervisor's requests */
async function getAllVehicleRequests(req, res, next) {
  const { requestedBy } = req.query;
  const where = {};
  if (requestedBy) where.requestedBy = requestedBy;
  return listVehicleRequests(where, req, res, next);
}

/** GET /api/vehicle-requests/:id */
async function getVehicleRequestById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const request = await VehicleRequest.findByPk(id, { include: INCLUDES });
    if (!request) return error(res, 404, "Vehicle request not found");

    return success(res, 200, "Vehicle request fetched successfully", { data: request });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/vehicle-requests/warehouses/:allotmentVillageId
 *
 * The "To" dropdown's options: every warehouse belonging to the SAME
 * company as the chosen allotment. Resolved by walking
 * AllotmentVillage -> Allotment -> companyId -> Warehouse, since the
 * request only ever names an allotmentVillageId, not a company directly.
 */
async function getWarehousesForAllotmentVillage(req, res, next) {
  try {
    const { allotmentVillageId } = req.params;
    if (!allotmentVillageId) return error(res, 400, "allotmentVillageId is required");

    const av = await AllotmentVillage.findByPk(allotmentVillageId, {
      include: { model: Allotment, as: "allotment", attributes: ["id", "companyId"] },
    });
    if (!av) return error(res, 404, "AllotmentVillage not found");
    if (!av.allotment) return error(res, 404, "This allotment-village has no linked allotment");

    const warehouses = await Warehouse.findAll({
      where: { companyId: av.allotment.companyId },
      order: [["locationName", "ASC"]],
    });

    return success(res, 200, "Warehouses fetched successfully", { data: warehouses });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/vehicle-requests
 * body: { allotmentVillageId, toWarehouseId, approxBags, approxQtyKgs, note, requestedBy (optional) }
 *
 * "Create on behalf of": an L1/L2 can raise this for a supervisor who
 * doesn't use the app themselves, same rule as every other request type —
 * pass requestedBy = that supervisor's employee id. createdBy always
 * records who actually submitted it.
 */
async function createVehicleRequest(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    const { allotmentVillageId, toWarehouseId, approxBags, approxQtyKgs, note, requestedBy: onBehalfOf } = req.body;

    if (!allotmentVillageId) return error(res, 400, "allotmentVillageId is required");
    if (!toWarehouseId) return error(res, 400, "toWarehouseId is required");

    let requestedBy = req.employee.id;
    if (onBehalfOf && Number(onBehalfOf) !== req.employee.id) {
      if (!["L1", "L2"].includes(req.employee.level)) {
        return error(res, 403, "Only L1 or L2 employees can create a request on behalf of someone else");
      }
      const targetEmployee = await Employee.findByPk(onBehalfOf);
      if (!targetEmployee) return error(res, 404, "requestedBy employee not found");
      requestedBy = Number(onBehalfOf);
    }

    const av = await AllotmentVillage.findByPk(allotmentVillageId, {
      include: { model: Allotment, as: "allotment", attributes: ["id", "companyId"] },
    });
    if (!av) return error(res, 404, "AllotmentVillage not found");
    if (av.supervisorId !== requestedBy) {
      return error(res, 403, `Employee ${requestedBy} is not the assigned supervisor for this allotment-village`);
    }

    const warehouse = await Warehouse.findByPk(toWarehouseId);
    if (!warehouse) return error(res, 404, "Warehouse not found");
    if (Number(warehouse.companyId) !== Number(av.allotment.companyId)) {
      return error(res, 400, "This warehouse does not belong to the allotment's seed company");
    }

    const requestCode = await generateId(VehicleRequest, "VR");

    const request = await VehicleRequest.create({
      requestCode,
      requestedBy,
      createdBy: req.employee.id,
      allotmentVillageId,
      toWarehouseId,
      approxBags,
      approxQtyKgs,
      note,
      status: "pending",
    });

    const created = await VehicleRequest.findByPk(request.id, { include: INCLUDES });

    return success(res, 201, "Vehicle request created successfully", { data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/vehicle-requests/:id — L3 edit, allowed only while Pending.
 * body (any subset): { toWarehouseId, approxBags, approxQtyKgs, note }
 */
async function updateVehicleRequest(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const request = await VehicleRequest.findByPk(id, {
      include: { model: AllotmentVillage, as: "allotmentVillage", include: { model: Allotment, as: "allotment" } },
    });
    if (!request) return error(res, 404, "Vehicle request not found");

    if (request.status !== "pending") {
      return error(res, 409, "Vehicle requests can only be edited while Pending");
    }

    const { toWarehouseId, approxBags, approxQtyKgs, note } = req.body;

    if (toWarehouseId !== undefined) {
      const warehouse = await Warehouse.findByPk(toWarehouseId);
      if (!warehouse) return error(res, 404, "Warehouse not found");
      if (Number(warehouse.companyId) !== Number(request.allotmentVillage.allotment.companyId)) {
        return error(res, 400, "This warehouse does not belong to the allotment's seed company");
      }
    }

    await request.update({
      ...(toWarehouseId !== undefined && { toWarehouseId }),
      ...(approxBags !== undefined && { approxBags }),
      ...(approxQtyKgs !== undefined && { approxQtyKgs }),
      ...(note !== undefined && { note }),
    });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, "Vehicle request updated successfully", { data: updated });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/vehicle-requests/:id/mark-in-process — L1 action */
async function markVehicleRequestInProcess(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    const { id } = req.params;
    const request = await VehicleRequest.findByPk(id);
    if (!request) return error(res, 404, "Vehicle request not found");

    if (request.status !== "pending") {
      return error(res, 409, `Cannot mark in-process a request with status "${request.status}"`);
    }

    await request.update({ status: "in_process" });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, "Vehicle request marked in process", { data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/vehicle-requests/:id/assign — L1 action.
 * body: { logisticsPartnerId, vehicleId }
 * Stores transport, vehicle number, and driver number (via the Vehicle
 * association — not duplicated as separate fields), plus who approved it,
 * and flips status to "assigned".
 */
async function assignVehicleRequest(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    const { id } = req.params;
    const { logisticsPartnerId, vehicleId } = req.body;

    if (!logisticsPartnerId) return error(res, 400, "logisticsPartnerId is required");
    if (!vehicleId) return error(res, 400, "vehicleId is required");

    const request = await VehicleRequest.findByPk(id);
    if (!request) return error(res, 404, "Vehicle request not found");

    if (!["pending", "in_process"].includes(request.status)) {
      return error(res, 409, `Cannot assign a vehicle to a request with status "${request.status}"`);
    }

    const partner = await LogisticsPartner.findByPk(logisticsPartnerId);
    if (!partner) return error(res, 404, "Logistics partner not found");

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return error(res, 404, "Vehicle not found");
    if (Number(vehicle.logisticsPartnerId) !== Number(logisticsPartnerId)) {
      return error(res, 400, "This vehicle does not belong to the selected logistics partner");
    }

    await request.update({
      status: "assigned",
      logisticsPartnerId,
      vehicleId,
      assignedBy: req.employee.id,
    });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, "Vehicle assigned successfully", { data: updated });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/vehicle-requests/:id/cancel — L1 action */
async function cancelVehicleRequest(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    const { id } = req.params;
    const request = await VehicleRequest.findByPk(id);
    if (!request) return error(res, 404, "Vehicle request not found");

    if (["assigned", "cancelled"].includes(request.status)) {
      return error(res, 409, `Cannot cancel a request with status "${request.status}"`);
    }

    await request.update({ status: "cancelled", cancelledBy: req.employee.id });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, "Vehicle request cancelled", { data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyVehicleRequests,
  getAllVehicleRequests,
  getVehicleRequestById,
  getWarehousesForAllotmentVillage,
  createVehicleRequest,
  updateVehicleRequest,
  markVehicleRequestInProcess,
  assignVehicleRequest,
  cancelVehicleRequest,
};
"use strict";
const { Op } = require("sequelize");
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
  SeedCompany,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");
const { createSummaryHandlers } = require("../utils/statusSummary");
const { myRequestsScope, withCreatorFlags } = require("../utils/requestOwnership");
const { vehicleRequestMessages } = require("../constants/message/vehicleRequestMessages");

const INCLUDES = [
  {
    model: Employee,
    as: "requester",
    attributes: ["id", "empId", "name", "level"],
  },
  {
    model: Employee,
    as: "creator",
    attributes: ["id", "empId", "name", "level"],
  },
  { model: Employee, as: "assigner", attributes: ["id", "empId", "name"] },
  {
    model: AllotmentVillage,
    as: "allotmentVillage",
    include: [
      { model: Village, as: "village", attributes: ["id", "name"] },
      {
        model: Allotment,
        as: "allotment",
        attributes: ["id", "allotmentId", "companyId"],
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
  {
    model: LogisticsPartner,
    as: "logisticsPartner",
    attributes: ["id", "name"],
  },
  {
    model: Vehicle,
    as: "vehicle",
    attributes: ["id", "regNo", "driverName", "driverNumber"],
  },
];

const listVehicleRequests = async (where, req, res, next, { viewerId } = {}) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, villageId, search } = req.query;

    if (status) where.status = status;
    // Partial match: "0011", "VR-00" or "vr-0011" all find VR-0011.
    if (search?.trim()) where.requestCode = { [Op.like]: `%${search.trim()}%` };

    // "village" is a Village id. A request points at an AllotmentVillage, so
    // filter on the allotment-villages that belong to that village.
    if (villageId) {
      const allotmentVillages = await AllotmentVillage.findAll({
        where: { villageId: villageId },
        attributes: ["id"],
      });
      where.allotmentVillageId = allotmentVillages.map((av) => av.id);
    }

    const result = await VehicleRequest.findAndCountAll({
      where,
      include: INCLUDES,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    const response = buildPaginatedResponse(result, page, limit);
    if (viewerId) response.data = withCreatorFlags(result.rows, viewerId); // createdByMe / createdOnBehalf / canEdit
    return success(res, 200, vehicleRequestMessages.vehicleRequestsFetchedSuccessfully, response);
  } catch (err) {
    next(err);
  }
};

/** GET /api/vehicle-requests/my-requests — the L3 "Requests" tab: own requests only */
const getMyVehicleRequests = async (req, res, next) => {
  if (!req.employee) return error(res, 401, vehicleRequestMessages.authenticationRequired);
  // Raised for me + created by me for a supervisor; rows carry createdByMe / createdOnBehalf / canEdit.
  return listVehicleRequests(myRequestsScope(req.employee.id), req, res, next, { viewerId: req.employee.id });
};

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
    if (!id) return error(res, 400, vehicleRequestMessages.idIsRequired);

    const request = await VehicleRequest.findByPk(id, { include: INCLUDES });
    if (!request) return error(res, 404, vehicleRequestMessages.vehicleRequestNotFound);

    return success(res, 200, vehicleRequestMessages.vehicleRequestFetchedSuccessfully, {
      data: request,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/vehicle-requests/warehouses/:allotmentVillageId
 */
async function getWarehousesForAllotmentVillage(req, res, next) {
  try {
    const { allotmentVillageId } = req.params;
    if (!allotmentVillageId)
      return error(res, 400, vehicleRequestMessages.allotmentVillageIdIsRequired);

    const av = await AllotmentVillage.findByPk(allotmentVillageId, {
      include: {
        model: Allotment,
        as: "allotment",
        attributes: ["id", "companyId"],
      },
    });
    if (!av) return error(res, 404, vehicleRequestMessages.allotmentVillageNotFound);
    if (!av.allotment)
      return error(res, 404, vehicleRequestMessages.thisAllotmentVillageHasNoLinked);

    const warehouses = await Warehouse.findAll({
      where: { companyId: av.allotment.companyId },
      include: [
        {
          model: SeedCompany,
          as: "company",
          attributes: ["id", "name", "companyId"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return success(res, 200, vehicleRequestMessages.warehousesFetchedSuccessfully, {
      data: warehouses,
    });
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
    if (!req.employee) return error(res, 401, vehicleRequestMessages.authenticationRequired);

    const {
      allotmentVillageId,
      toWarehouseId,
      approxBags,
      approxQtyKgs,
      note,
      requestedBy: onBehalfOf,
    } = req.body;

    if (!allotmentVillageId)
      return error(res, 400, vehicleRequestMessages.allotmentVillageIdIsRequired);
    if (!toWarehouseId) return error(res, 400, vehicleRequestMessages.toWarehouseIdIsRequired);

    let requestedBy = req.employee.id;
    if (onBehalfOf && Number(onBehalfOf) !== req.employee.id) {
      if (!["L1", "L2"].includes(req.employee.level)) {
        return error(
          res,
          403,
          vehicleRequestMessages.onlyL1OrL2EmployeesCan,
        );
      }
      const targetEmployee = await Employee.findByPk(onBehalfOf);
      if (!targetEmployee)
        return error(res, 404, vehicleRequestMessages.requestedByEmployeeNotFound);
      requestedBy = Number(onBehalfOf);
    }

    const av = await AllotmentVillage.findByPk(allotmentVillageId, {
      include: {
        model: Allotment,
        as: "allotment",
        attributes: ["id", "companyId"],
      },
    });
    if (!av) return error(res, 404, vehicleRequestMessages.allotmentVillageNotFound);
    if (av.supervisorId !== requestedBy) {
      return error(
        res,
        403,
        vehicleRequestMessages.employeeIsNotTheAssignedSupervisor(requestedBy),
      );
    }
    if (av.status === "closed") {
      return error(res, 400, vehicleRequestMessages.thisAllotmentIsClosedChooseAn);
    }

    const warehouse = await Warehouse.findByPk(toWarehouseId);
    if (!warehouse) return error(res, 404, vehicleRequestMessages.warehouseNotFound);
    if (Number(warehouse.companyId) !== Number(av.allotment.companyId)) {
      return error(
        res,
        400,
        vehicleRequestMessages.thisWarehouseDoesNotBelongTo,
      );
    }

    const request = await VehicleRequest.create({
      requestedBy,
      createdBy: req.employee.id,
      allotmentVillageId,
      toWarehouseId,
      approxBags,
      approxQtyKgs,
      note,
      status: "pending",
    });
    const requestCode = await generateId("VR", request?.id);
    await request.update({ requestCode });

    const created = await VehicleRequest.findByPk(request.id, {
      include: INCLUDES,
    });

    return success(res, 201, vehicleRequestMessages.vehicleRequestCreatedSuccessfully, {
      data: created,
    });
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
    if (!id) return error(res, 400, vehicleRequestMessages.idIsRequired);

    const request = await VehicleRequest.findByPk(id, {
      include: {
        model: AllotmentVillage,
        as: "allotmentVillage",
        include: { model: Allotment, as: "allotment" },
      },
    });
    if (!request) return error(res, 404, vehicleRequestMessages.vehicleRequestNotFound);

    if (request.status !== "pending") {
      return error(
        res,
        409,
        vehicleRequestMessages.vehicleRequestsCanOnlyBeEdited,
      );
    }

    const { toWarehouseId, approxBags, approxQtyKgs, note } = req.body;

    if (toWarehouseId !== undefined) {
      const warehouse = await Warehouse.findByPk(toWarehouseId);
      if (!warehouse) return error(res, 404, vehicleRequestMessages.warehouseNotFound);
      if (
        Number(warehouse.companyId) !==
        Number(request.allotmentVillage.allotment.companyId)
      ) {
        return error(
          res,
          400,
          vehicleRequestMessages.thisWarehouseDoesNotBelongTo,
        );
      }
    }

    await request.update({
      ...(toWarehouseId !== undefined && { toWarehouseId }),
      ...(approxBags !== undefined && { approxBags }),
      ...(approxQtyKgs !== undefined && { approxQtyKgs }),
      ...(note !== undefined && { note }),
    });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, vehicleRequestMessages.vehicleRequestUpdatedSuccessfully, {
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/vehicle-requests/:id/mark-in-process — L1 action */
async function markVehicleRequestInProcess(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, vehicleRequestMessages.authenticationRequired);

    const { id } = req.params;
    const request = await VehicleRequest.findByPk(id);
    if (!request) return error(res, 404, vehicleRequestMessages.vehicleRequestNotFound);

    if (request.status !== "pending") {
      return error(
        res,
        409,
        vehicleRequestMessages.cannotMarkInProcessARequest(request.status),
      );
    }

    await request.update({ status: "in_process" });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, vehicleRequestMessages.vehicleRequestMarkedInProcess, {
      data: updated,
    });
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
    if (!req.employee) return error(res, 401, vehicleRequestMessages.authenticationRequired);

    const { id } = req.params;
    const { logisticsPartnerId, vehicleId } = req.body;

    if (!logisticsPartnerId)
      return error(res, 400, vehicleRequestMessages.logisticsPartnerIdIsRequired);
    if (!vehicleId) return error(res, 400, vehicleRequestMessages.vehicleIdIsRequired);

    const request = await VehicleRequest.findByPk(id);
    if (!request) return error(res, 404, vehicleRequestMessages.vehicleRequestNotFound);

    if (!["pending", "in_process"].includes(request.status)) {
      return error(
        res,
        409,
        vehicleRequestMessages.cannotAssignAVehicleToA(request.status),
      );
    }

    const partner = await LogisticsPartner.findByPk(logisticsPartnerId);
    if (!partner) return error(res, 404, vehicleRequestMessages.logisticsPartnerNotFound);

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return error(res, 404, vehicleRequestMessages.vehicleNotFound);
    if (Number(vehicle.logisticsPartnerId) !== Number(logisticsPartnerId)) {
      return error(
        res,
        400,
        vehicleRequestMessages.thisVehicleDoesNotBelongTo,
      );
    }

    await request.update({
      status: "assigned",
      logisticsPartnerId,
      vehicleId,
      assignedBy: req.employee.id,
    });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, vehicleRequestMessages.vehicleAssignedSuccessfully, {
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/vehicle-requests/:id/cancel — L1 action */
async function cancelVehicleRequest(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, vehicleRequestMessages.authenticationRequired);

    const { id } = req.params;
    const request = await VehicleRequest.findByPk(id);
    if (!request) return error(res, 404, vehicleRequestMessages.vehicleRequestNotFound);

    if (["assigned", "cancelled"].includes(request.status)) {
      return error(
        res,
        409,
        vehicleRequestMessages.cannotCancelARequestWithStatus(request.status),
      );
    }

    await request.update({ status: "cancelled", cancelledBy: req.employee.id });

    const updated = await VehicleRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, vehicleRequestMessages.vehicleRequestCancelled, { data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * KPI cards — GET /my-summary (Requests page, own requests) and
 * GET /summary (Verifications / Approvals pages, everyone's).
 * Returns { total, pending, inProcess, assigned, cancelled }.
 */
const {
  getMySummary: getMyVehicleSummary,
  getSummary: getVehicleSummary,
} = createSummaryHandlers(VehicleRequest, ["pending", "in_process", "assigned", "cancelled"], { label: "Vehicle request" });

module.exports = {
  getMyVehicleSummary,
  getVehicleSummary,
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

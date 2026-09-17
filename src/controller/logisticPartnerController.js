"use strict";
const { Op } = require("sequelize");
const { LogisticsPartner, Vehicle, State } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/** GET /api/logistics?search=sri&page=1&limit=20 */
const getAllLogisticsPartners = async (req, res, next) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { logisticsId: { [Op.like]: term } },
      ];
    }

    const result = await LogisticsPartner.findAndCountAll({
      where,
      include: [{ model: State, as: "state", attributes: ["id", "name"] }],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return success(
      res,
      200,
      "Logistics partners fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/logistics/:id — includes its vehicles */
const getLogisticsPartnerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const partner = await LogisticsPartner.findByPk(id, {
      include: [{ model: Vehicle, as: "vehicles" }],
    });
    if (!partner) return error(res, 404, "Logistics partner not found");

    return success(res, 200, "Logistics partner fetched successfully", {
      data: partner,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/logistics */
const createLogisticsPartner = async (req, res, next) => {
  try {
    const {
      name,
      ownerName,
      ownerNumber,
      rate,
      fullAddress,
      location,
      pincode,
      stateId,
      status,
    } = req.body;

    if (!name) return error(res, 400, "name is required");
    if (!ownerName) return error(res, 400, "ownerName is required");

    const partner = await LogisticsPartner.create({
      name,
      ownerName,
      ownerNumber,
      rate,
      fullAddress,
      location,
      pincode,
      stateId,
      status: status || "Active",
    });
    const logisticsId = await generateId("LG", partner?.id);
    await partner?.update({ logisticsId });

    return success(res, 201, "Logistics partner created successfully", {
      data: partner,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/logistics/:id */
const updateLogisticsPartner = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const partner = await LogisticsPartner.findByPk(id);
    if (!partner) return error(res, 404, "Logistics partner not found");

    const {
      name,
      ownerName,
      ownerNumber,
      rate,
      fullAddress,
      location,
      pincode,
      stateId,
      status,
    } = req.body;

    await partner.update({
      ...(name !== undefined && { name }),
      ...(ownerName !== undefined && { ownerName }),
      ...(ownerNumber !== undefined && { ownerNumber }),
      ...(rate !== undefined && { rate }),
      ...(fullAddress !== undefined && { fullAddress }),
      ...(location !== undefined && { location }),
      ...(pincode !== undefined && { pincode }),
      ...(stateId !== undefined && { stateId }),
      ...(status !== undefined && { status }),
    });

    return success(res, 200, "Logistics partner updated successfully", {
      data: partner,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/logistics/:logisticsPartnerId/vehicles */
const getVehiclesByLogisticsPartnerId = async (req, res, next) => {
  try {
    const { logisticsPartnerId } = req.params;
    if (!logisticsPartnerId)
      return error(res, 400, "logisticsPartnerId is required");

    const partner = await LogisticsPartner.findByPk(logisticsPartnerId);
    if (!partner) return error(res, 404, "Logistics partner not found");

    const { page, limit, offset } = getPagination(req.query);

    const result = await Vehicle.findAndCountAll({
      where: { logisticsPartnerId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Vehicles fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** POST /api/logistics/:logisticsPartnerId/vehicles */
const createVehicle = async (req, res, next) => {
  try {
    const { logisticsPartnerId } = req.params;
    if (!logisticsPartnerId)
      return error(res, 400, "logisticsPartnerId is required");

    const partner = await LogisticsPartner.findByPk(logisticsPartnerId);
    if (!partner) return error(res, 404, "Logistics partner not found");

    const { type, regNo, capacity, driverName, driverNumber } = req.body;
    // if (!type) return error(res, 400, "type is required");
    // if (!regNo) return error(res, 400, "regNo is required");

    const vehicle = await Vehicle.create({
      logisticsPartnerId,
      type,
      regNo,
      capacity,
      driverName,
      driverNumber,
    });
    const vehicleId = generateId("VEH", vehicle?.id);
    await vehicle.update({ vehicleId });

    return success(res, 201, "Vehicle created successfully", { data: vehicle });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/vehicles/:id */
const updateVehicle = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    if (!vehicleId) return error(res, 400, "vehicleId is required");

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return error(res, 404, "Vehicle not found");

    const { type, regNo, capacity, driverName, driverNumber } = req.body;

    await vehicle.update({
      ...(type !== undefined && { type }),
      ...(regNo !== undefined && { regNo }),
      ...(capacity !== undefined && { capacity }),
      ...(driverName !== undefined && { driverName }),
      ...(driverNumber !== undefined && { driverNumber }),
    });

    return success(res, 200, "Vehicle updated successfully", { data: vehicle });
  } catch (err) {
    next(err);
  }
};

const getVehicleById = async (req, res, next) => {
  const { vehicleId } = req.params;
  if (!vehicleId) {
    return res.status(400).json({
      success: false,
      message: "vehicleId is required",
    });
  }
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: "Vehicle not found",
    });
  }
  return res.status(200).json({
    success: true,
    message: "Vehicle fetched successfully",
    data: vehicle,
  });
};

const updateLogisticsPartnerStatus = async (req, res, next) => {
  try {
    const { logisticsId } = req.params;
    const { status } = req.body;
    if (!logisticsId) return error(res, 400, "logisticsId is required");

    if (!status) return error(res, 400, "status is required");

    if (!["Active", "Inactive"].includes(status))
      return error(res, 400, "Invalid status");

    const logisticPartner = await LogisticsPartner.findByPk(logisticsId);
    if (!logisticPartner) {
      return error(res, 404, "LogisticsPartner not found");
    }
    await logisticPartner.update({ status });
    return success(res, 200, "LogisticsPartner status updated successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllLogisticsPartners,
  getLogisticsPartnerById,
  createLogisticsPartner,
  updateLogisticsPartner,
  getVehiclesByLogisticsPartnerId,
  createVehicle,
  updateVehicle,
  getVehicleById,
  updateLogisticsPartnerStatus,
};

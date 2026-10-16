"use strict";
const { Router } = require("express");
const { vehicleRequestRoutes } = require("../constants/routes");
const {
  getMyVehicleRequests,
  getMyVehicleSummary,
  getVehicleSummary,
  getAllVehicleRequests,
  getVehicleRequestById,
  getWarehousesForAllotmentVillage,
  createVehicleRequest,
  updateVehicleRequest,
  markVehicleRequestInProcess,
  assignVehicleRequest,
  cancelVehicleRequest,
} = require("../controller/vehicleRequestController");
const { getMyAssignedAllotmentVillages } = require("../controller/allotmentController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get(vehicleRequestRoutes.myRequests, getMyVehicleRequests);
router.get(vehicleRequestRoutes.allotmentVillages,getMyAssignedAllotmentVillages)
router.get(vehicleRequestRoutes.warehousesByAllotmentVillageId, getWarehousesForAllotmentVillage);
router.get(vehicleRequestRoutes.root, getAllVehicleRequests);
router.get(vehicleRequestRoutes.mySummary, getMyVehicleSummary); // Requests page KPIs (own)
router.get(vehicleRequestRoutes.summary, getVehicleSummary); // Verifications / Approvals KPIs (all)
router.get(vehicleRequestRoutes.byId, getVehicleRequestById);
router.post(vehicleRequestRoutes.root, createVehicleRequest);
router.put(vehicleRequestRoutes.byId, updateVehicleRequest);
router.put(vehicleRequestRoutes.markInProcessById, markVehicleRequestInProcess);
router.put(vehicleRequestRoutes.assignById, assignVehicleRequest);
router.put(vehicleRequestRoutes.cancelById, cancelVehicleRequest);                         

module.exports = router;

"use strict";
const { Router } = require("express");
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

router.get("/my-requests", getMyVehicleRequests);
router.get("/allotment-villages",getMyAssignedAllotmentVillages)
router.get("/warehouses/:allotmentVillageId", getWarehousesForAllotmentVillage);
router.get("/", getAllVehicleRequests);
router.get("/my-summary", getMyVehicleSummary); // Requests page KPIs (own)
router.get("/summary", getVehicleSummary); // Verifications / Approvals KPIs (all)
router.get("/:id", getVehicleRequestById);
router.post("/", createVehicleRequest);
router.put("/:id", updateVehicleRequest);
router.put("/:id/mark-in-process", markVehicleRequestInProcess);
router.put("/:id/assign", assignVehicleRequest);
router.put("/:id/cancel", cancelVehicleRequest);

module.exports = router;

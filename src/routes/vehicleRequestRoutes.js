"use strict";
const { Router } = require("express");
const {
  getMyVehicleRequests,
  getAllVehicleRequests,
  getVehicleRequestById,
  getWarehousesForAllotmentVillage,
  createVehicleRequest,
  updateVehicleRequest,
  markVehicleRequestInProcess,
  assignVehicleRequest,
  cancelVehicleRequest,
} = require("../controller/vehicleRequestController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get("/my-requests", getMyVehicleRequests);
router.get("/warehouses/:allotmentVillageId", getWarehousesForAllotmentVillage);
router.get("/", getAllVehicleRequests);
router.get("/:id", getVehicleRequestById);
router.post("/", createVehicleRequest);
router.put("/:id", updateVehicleRequest);
router.put("/:id/mark-in-process", markVehicleRequestInProcess);
router.put("/:id/assign", assignVehicleRequest);
router.put("/:id/cancel", cancelVehicleRequest);

module.exports = router;

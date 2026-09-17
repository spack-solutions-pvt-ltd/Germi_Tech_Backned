"use strict";
const { Router } = require("express");
const {
  getAllLogisticsPartners,
  getLogisticsPartnerById,
  createLogisticsPartner,
  updateLogisticsPartner,
  getVehiclesByLogisticsPartnerId,
  createVehicle,
  updateVehicle,
  getVehicleById,
  updateLogisticsPartnerStatus,
} = require("../controller/logisticPartnerController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get("/", getAllLogisticsPartners);
router.get("/:id", getLogisticsPartnerById);
router.post("/", createLogisticsPartner);
router.put("/:id", updateLogisticsPartner);
router.patch("/status/:logisticsId", updateLogisticsPartnerStatus);


// Nested: vehicles belonging to this logistics partner
router.get("/:logisticsPartnerId/vehicles", getVehiclesByLogisticsPartnerId);
router.post("/:logisticsPartnerId/vehicles", createVehicle);

router.put("/vehicles/:vehicleId", updateVehicle);
router.get("/vehicles/:vehicleId", getVehicleById);

module.exports = router;

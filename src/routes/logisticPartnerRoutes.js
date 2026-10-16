"use strict";
const { Router } = require("express");
const { logisticPartnerRoutes } = require("../constants/routes");
const {
  getLogisticsSummary,
  getAllLogisticsPartners,
  getLogisticsPartnerById,
  createLogisticsPartner,
  updateLogisticsPartner,
  getVehiclesByLogisticsPartnerId,
  createVehicle,
  updateVehicle,
  getVehicleById,
  updateLogisticsPartnerStatus,
  getLogisticsPartnerPayments,
  getLogisticsPartnerPaymentById,
} = require("../controller/logisticPartnerController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get(logisticPartnerRoutes.summary, getLogisticsSummary); // KPI cards — before /:id
router.get(logisticPartnerRoutes.root, getAllLogisticsPartners);
router.get(logisticPartnerRoutes.byId, getLogisticsPartnerById);
router.get(logisticPartnerRoutes.paymentsById, getLogisticsPartnerPayments); // Transport payments history + totals
router.get(logisticPartnerRoutes.paymentsByIdAndPaymentId, getLogisticsPartnerPaymentById); // payment drawer
router.post(logisticPartnerRoutes.root, createLogisticsPartner);
router.put(logisticPartnerRoutes.byId, updateLogisticsPartner);
router.patch(logisticPartnerRoutes.statusByLogisticsId, updateLogisticsPartnerStatus);


// Nested: vehicles belonging to this logistics partner
router.get(logisticPartnerRoutes.vehiclesByLogisticsPartnerId, getVehiclesByLogisticsPartnerId);
router.post(logisticPartnerRoutes.vehiclesByLogisticsPartnerId, createVehicle);

router.put(logisticPartnerRoutes.vehiclesByVehicleId, updateVehicle);
router.get(logisticPartnerRoutes.vehiclesByVehicleId, getVehicleById);

module.exports = router;

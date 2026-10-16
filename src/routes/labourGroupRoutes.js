"use strict";
const { Router } = require("express");
const { labourGroupRoutes } = require("../constants/routes");
const {
  getLaborGroupSummary,
  getLaborGroupPayments,
  getLaborGroupPaymentById,
  getAllLaborGroups,
  getLaborGroupById,
  createLaborGroup,
  updateLaborGroup,
} = require("../controller/labourGroupController");

const router = Router();

router.get(labourGroupRoutes.summary, getLaborGroupSummary); // KPI cards — before /:id
router.get(labourGroupRoutes.root, getAllLaborGroups);
router.get(labourGroupRoutes.byId, getLaborGroupById);
router.get(labourGroupRoutes.paymentsById, getLaborGroupPayments); // payments history
router.get(labourGroupRoutes.paymentsByIdAndPaymentId, getLaborGroupPaymentById); // payment drawer: wage breakdown
router.post(labourGroupRoutes.root, createLaborGroup);
router.put(labourGroupRoutes.byId, updateLaborGroup);

module.exports = router;

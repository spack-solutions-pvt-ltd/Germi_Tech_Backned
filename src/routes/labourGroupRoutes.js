"use strict";
const { Router } = require("express");
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

router.get("/summary", getLaborGroupSummary); // KPI cards — before /:id
router.get("/", getAllLaborGroups);
router.get("/:id", getLaborGroupById);
router.get("/:id/payments", getLaborGroupPayments); // payments history
router.get("/:id/payments/:paymentId", getLaborGroupPaymentById); // payment drawer: wage breakdown
router.post("/", createLaborGroup);
router.put("/:id", updateLaborGroup);

module.exports = router;

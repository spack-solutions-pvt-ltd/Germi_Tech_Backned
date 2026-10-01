"use strict";
const { Router } = require("express");
const { requireLevel } = require("../middleWare/auth.middleware");
const {
  PAYMENT_VIEW_LEVELS,
  PAYMENT_PROCESS_LEVELS,
} = require("../constants/payments");
const {
  getPayments,
  getPaymentSummary,
  getPaymentFilterOptions,
  getPaymentById,
  updatePaymentDetails,
  processPayment,
} = require("../controller/paymentController");

const router = Router();
const canProcess = requireLevel(...PAYMENT_PROCESS_LEVELS);

// L1 and L2 can view; only L2 can edit details / process.
router.use(requireLevel(...PAYMENT_VIEW_LEVELS));

router.get("/summary", getPaymentSummary); // KPI cards
router.get("/filter-options", getPaymentFilterOptions); // created-by / processed-by dropdowns
router.get("/", getPayments); // ?status=pending|processed + filters
router.get("/:id", getPaymentById); // process / details drawer
router.put("/:id", canProcess, updatePaymentDetails); // save mode, reference ID, date, remark (Pending only)
router.put("/:id/process", canProcess, processPayment); // Pending -> Processed

module.exports = router;

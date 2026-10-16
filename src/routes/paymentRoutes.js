"use strict";
const { Router } = require("express");
const { paymentRoutes } = require("../constants/routes");
const { requireLevel } = require("../middleWare/auth.middleware");
const {
  PAYMENT_VIEW_LEVELS,
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

// L1 and L2 can view; only L2 can edit details / process.
router.use(requireLevel(...PAYMENT_VIEW_LEVELS));

router.get(paymentRoutes.summary, getPaymentSummary); // KPI cards
router.get(paymentRoutes.filterOptions, getPaymentFilterOptions); // created-by / processed-by dropdowns
router.get(paymentRoutes.root, getPayments); // ?status=pending|processed + filters
router.get(paymentRoutes.byId, getPaymentById); // process / details drawer
router.put(paymentRoutes.byId, updatePaymentDetails); // save mode, reference ID, date, remark (Pending only)
router.patch(paymentRoutes.processById, processPayment); // Pending -> Processed

module.exports = router;

"use strict";
const { Router } = require("express");
const { expenseRequestRoutes } = require("../constants/routes");
const {
  getMyExpenseRequests,
  getMyExpenseSummary,
  getExpenseSummary,
  getAllExpenseRequests,
  getExpenseRequestById,
  createExpenseRequest,
  updateExpenseRequest,
  verifyExpenseRequest,
  approveExpenseRequest,
  rejectExpenseRequest,
} = require("../controller/expenseRequestController");
const {
  expenseRequestUpload,
} = require("../middleWare/requestUpload.middleware");

const router = Router();

router.get(expenseRequestRoutes.myRequests, getMyExpenseRequests);
router.get(expenseRequestRoutes.root, getAllExpenseRequests);
router.get(expenseRequestRoutes.mySummary, getMyExpenseSummary); // Requests page KPIs (own)
router.get(expenseRequestRoutes.summary, getExpenseSummary); // Verifications / Approvals KPIs (all)
router.get(expenseRequestRoutes.byId, getExpenseRequestById);
router.post(expenseRequestRoutes.root, expenseRequestUpload, createExpenseRequest);
router.put(expenseRequestRoutes.byId, expenseRequestUpload, updateExpenseRequest); // only while status = pending
router.put(expenseRequestRoutes.verifyById, verifyExpenseRequest);
router.put(expenseRequestRoutes.approveById, approveExpenseRequest);
router.put(expenseRequestRoutes.rejectById, rejectExpenseRequest);

module.exports = router;

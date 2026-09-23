"use strict";
const { Router } = require("express");
const {
  getMyExpenseRequests,
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
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get("/my-requests", getMyExpenseRequests);
router.get("/", getAllExpenseRequests);
router.get("/:id", getExpenseRequestById);
router.post("/", expenseRequestUpload, createExpenseRequest);
router.put("/:id", expenseRequestUpload, updateExpenseRequest); // only while status = pending
router.put("/:id/verify", verifyExpenseRequest);
router.put("/:id/approve", approveExpenseRequest);
router.put("/:id/reject", rejectExpenseRequest);

module.exports = router;

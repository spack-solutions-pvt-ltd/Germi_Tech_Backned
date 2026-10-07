"use strict";
const { Router } = require("express");
const { loadingRequestUpload } = require("../middleWare/requestUpload.middleware");
const {
  getMyAssignedAllotmentVillages,
  getAllotmentVillagesBySupervisor,
  getSupervisorOptions,
} = require("../controller/allotmentController");
const {
  getLoadingWarehouses,
  getMyLoadingRequests,
  getAllLoadingRequests,
  getMyLoadingSummary,
  getLoadingSummary,
  getLoadingRequestById,
  getLoadingRequestPayments,
  createLoadingRequest,
  updateLoadingRequest,
  updateLoadingAmounts,
  verifyLoadingRequest,
  cancelLoadingRequest,
  createLoadingPayments,
} = require("../controller/loadingRequestsController");

// Access to each action is controlled by role permissions, not by level.
const router = Router();

// Requests → Loading (own requests)
router.get("/my-requests", getMyLoadingRequests);
router.get("/my-summary", getMyLoadingSummary);
router.get("/allotment-villages", getMyAssignedAllotmentVillages); // "Allotment" dropdown — my own (Self)
router.get("/supervisors", getSupervisorOptions); // "Supervisor" dropdown on a loading row
router.get("/supervisors/:supervisorId/allotment-villages", getAllotmentVillagesBySupervisor); // that supervisor's allotments
router.get("/warehouses", getLoadingWarehouses); // "To location (warehouse)" dropdown

// Verifications / Approvals
router.get("/summary", getLoadingSummary);
router.get("/", getAllLoadingRequests);

router.get("/:id", getLoadingRequestById);
router.get("/:id/payments", getLoadingRequestPayments);
router.post("/", loadingRequestUpload, createLoadingRequest);
router.put("/:id", loadingRequestUpload, updateLoadingRequest); // creator only, Pending only
router.put("/:id/amounts", updateLoadingAmounts);
router.put("/:id/verify", verifyLoadingRequest);
router.put("/:id/cancel", cancelLoadingRequest);
router.post("/:id/payments", createLoadingPayments); // transport | hamali | both

module.exports = router;

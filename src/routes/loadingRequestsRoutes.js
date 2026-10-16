"use strict";
const { Router } = require("express");
const { loadingRequestsRoutes } = require("../constants/routes");
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
router.get(loadingRequestsRoutes.myRequests, getMyLoadingRequests);
router.get(loadingRequestsRoutes.mySummary, getMyLoadingSummary);
router.get(loadingRequestsRoutes.allotmentVillages, getMyAssignedAllotmentVillages); // "Allotment" dropdown — my own (Self)
router.get(loadingRequestsRoutes.supervisors, getSupervisorOptions); // "Supervisor" dropdown on a loading row
router.get(loadingRequestsRoutes.supervisorsAllotmentVillagesBySupervisorId, getAllotmentVillagesBySupervisor); // that supervisor's allotments
router.get(loadingRequestsRoutes.warehouses, getLoadingWarehouses); // "To location (warehouse)" dropdown

// Verifications / Approvals
router.get(loadingRequestsRoutes.summary, getLoadingSummary);
router.get(loadingRequestsRoutes.root, getAllLoadingRequests);

router.get(loadingRequestsRoutes.byId, getLoadingRequestById);
router.get(loadingRequestsRoutes.paymentsById, getLoadingRequestPayments);
router.post(loadingRequestsRoutes.root, loadingRequestUpload, createLoadingRequest);
router.put(loadingRequestsRoutes.byId, loadingRequestUpload, updateLoadingRequest); // creator only, Pending only
router.put(loadingRequestsRoutes.amountsById, updateLoadingAmounts);
router.put(loadingRequestsRoutes.verifyById, verifyLoadingRequest);
router.put(loadingRequestsRoutes.cancelById, cancelLoadingRequest);
router.post(loadingRequestsRoutes.paymentsById, createLoadingPayments); // transport | hamali | both

module.exports = router;

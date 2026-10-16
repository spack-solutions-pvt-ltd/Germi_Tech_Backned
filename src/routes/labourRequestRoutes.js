"use strict";
const { Router } = require("express");
const { labourRequestRoutes } = require("../constants/routes");
const {
  getMyLabourRequests,
  getMyLabourSummary,
  getLabourSummary,
  getAllLabourRequests,
  getLabourRequestById,
  createLabourRequest,
  updateLabourRequest,
  verifyLabourRequest,
  approveLabourRequest,
  rejectLabourRequest,
} = require("../controller/labourRequestController");
const {
  labourRequestUpload,
} = require("../middleWare/requestUpload.middleware");
const { getMyAssignedAllotmentVillages } = require("../controller/allotmentController");

const router = Router();

router.get(labourRequestRoutes.myRequests, getMyLabourRequests); //my requests
router.get(labourRequestRoutes.allotmentVillages,getMyAssignedAllotmentVillages)
router.get(labourRequestRoutes.root, getAllLabourRequests); //verifications and approvals 
router.get(labourRequestRoutes.mySummary, getMyLabourSummary); // Requests page KPIs (own)
router.get(labourRequestRoutes.summary, getLabourSummary); // Verifications / Approvals KPIs (all)
router.get(labourRequestRoutes.byId, getLabourRequestById); 
router.post(labourRequestRoutes.root, labourRequestUpload, createLabourRequest);
router.put(labourRequestRoutes.byId, labourRequestUpload, updateLabourRequest);
router.put(labourRequestRoutes.verifyById, verifyLabourRequest);
router.put(labourRequestRoutes.approveById, approveLabourRequest);
router.put(labourRequestRoutes.rejectById, rejectLabourRequest);

module.exports = router;

"use strict";
const { Router } = require("express");
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

router.get("/my-requests", getMyLabourRequests); //my requests
router.get("/allotment-villages",getMyAssignedAllotmentVillages)
router.get("/", getAllLabourRequests); //verifications and approvals 
router.get("/my-summary", getMyLabourSummary); // Requests page KPIs (own)
router.get("/summary", getLabourSummary); // Verifications / Approvals KPIs (all)
router.get("/:id", getLabourRequestById); 
router.post("/", labourRequestUpload, createLabourRequest);
router.put("/:id", labourRequestUpload, updateLabourRequest);
router.put("/:id/verify", verifyLabourRequest);
router.put("/:id/approve", approveLabourRequest);
router.put("/:id/reject", rejectLabourRequest);

module.exports = router;

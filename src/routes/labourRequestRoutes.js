"use strict";
const { Router } = require("express");
const {
  getMyLabourRequests,
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
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get("/my-requests", getMyLabourRequests); // L3 "Requests" tab
router.get("/allotment-villages",getMyAssignedAllotmentVillages)
router.get("/", getAllLabourRequests); // Verifications/Approvals — every supervisor
router.get("/:id", getLabourRequestById);
router.post("/", labourRequestUpload, createLabourRequest);
router.put("/:id", labourRequestUpload, updateLabourRequest); // only while status = pending
router.put("/:id/verify", verifyLabourRequest);
router.put("/:id/approve", approveLabourRequest);
router.put("/:id/reject", rejectLabourRequest);
  
module.exports = router;

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

const router = Router();

router.get("/my-requests", getMyLabourRequests);
router.get("/allotment-villages",getMyAssignedAllotmentVillages)
router.get("/", getAllLabourRequests); 
router.get("/:id", getLabourRequestById);
router.post("/", labourRequestUpload, createLabourRequest);
router.put("/:id", labourRequestUpload, updateLabourRequest);
router.put("/:id/verify", verifyLabourRequest);
router.put("/:id/approve", approveLabourRequest);
router.put("/:id/reject", rejectLabourRequest);
  
module.exports = router;

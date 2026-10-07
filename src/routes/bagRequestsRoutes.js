"use strict";
const { Router } = require("express");
const {
  getMyBagsRequests,
  getAllBagsRequests,
  getBagsRequestById,
  getMyBagsSummary,
  getBagsSummary,
  createBagsRequest,
  updateBagsRequest,
  updateBagsRequestStatus,
} = require("../controller/bagsRequestController");

const router = Router();

router.get("/my-requests", getMyBagsRequests);
router.get("/my-summary", getMyBagsSummary);
router.get("/summary", getBagsSummary); 
router.get("/", getAllBagsRequests); 
router.get("/:id", getBagsRequestById);
router.post("/", createBagsRequest); 
router.put("/:id", updateBagsRequest);
router.put("/:id/status", updateBagsRequestStatus);

module.exports = router;

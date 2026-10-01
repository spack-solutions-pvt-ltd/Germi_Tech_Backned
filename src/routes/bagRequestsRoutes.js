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

router.get("/my-requests", getMyBagsRequests); // Requests → Bags
router.get("/my-summary", getMyBagsSummary);
router.get("/summary", getBagsSummary); // Verifications → Bags cards
router.get("/", getAllBagsRequests); // Verifications → Bags list
router.get("/:id", getBagsRequestById);
router.post("/", createBagsRequest); // Add Request
router.put("/:id", updateBagsRequest); // Pending only
router.put("/:id/status", updateBagsRequestStatus);


module.exports = router;

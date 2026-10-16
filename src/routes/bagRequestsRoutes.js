"use strict";
const { Router } = require("express");
const { bagRequestsRoutes } = require("../constants/routes");
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

router.get(bagRequestsRoutes.myRequests, getMyBagsRequests);
router.get(bagRequestsRoutes.mySummary, getMyBagsSummary);
router.get(bagRequestsRoutes.summary, getBagsSummary); 
router.get(bagRequestsRoutes.root, getAllBagsRequests); 
router.get(bagRequestsRoutes.byId, getBagsRequestById);
router.post(bagRequestsRoutes.root, createBagsRequest); 
router.put(bagRequestsRoutes.byId, updateBagsRequest);
router.put(bagRequestsRoutes.statusById, updateBagsRequestStatus);

module.exports = router;

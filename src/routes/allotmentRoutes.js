"use strict";
const { Router } = require("express");
const { allotmentRoutes } = require("../constants/routes");
const {
  getAllAllotments,
  getAllotmentsSummary,
  getAllotmentVillageTable,
  getAllotmentById,
  createAllotment,
  updateAllotment,
  deleteAllotment,
  addVillageAllotment,
  updateVillageAllotment,
  getMyAssignedAllotmentVillages,
  getVillageAllotmentsByAllotment,
} = require("../controller/allotmentController");

const router = Router();

// Fixed paths first — otherwise "/:id" would capture them.
router.get(allotmentRoutes.root, getAllAllotments);
router.get(allotmentRoutes.summary, getAllotmentsSummary); // KPI cards (same filters as the list)
router.get(allotmentRoutes.villageTable, getAllotmentVillageTable);
router.get(allotmentRoutes.myAssignments, getMyAssignedAllotmentVillages); // allotments assigned to the logged-in user

router.get(allotmentRoutes.byId, getAllotmentById);
router.post(allotmentRoutes.root, createAllotment);
router.put(allotmentRoutes.byId, updateAllotment);
router.delete(allotmentRoutes.byId, deleteAllotment);

router.get(allotmentRoutes.villagesById, getVillageAllotmentsByAllotment); // village allotments of one allotment
router.post(allotmentRoutes.villagesById, addVillageAllotment);
router.put(allotmentRoutes.villagesByIdAndVillageAllotmentId, updateVillageAllotment);

module.exports = router;

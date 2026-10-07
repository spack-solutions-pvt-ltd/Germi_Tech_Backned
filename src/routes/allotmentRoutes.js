"use strict";
const { Router } = require("express");
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
} = require("../controller/allotmentController");

const router = Router();

// Fixed paths first — otherwise "/:id" would capture them.
router.get("/", getAllAllotments);
router.get("/summary", getAllotmentsSummary); // KPI cards (same filters as the list)
router.get("/village-table", getAllotmentVillageTable);
router.get("/my-assignments", getMyAssignedAllotmentVillages); // allotments assigned to the logged-in user

router.get("/:id", getAllotmentById);
router.post("/", createAllotment);
router.put("/:id", updateAllotment);
router.delete("/:id", deleteAllotment);

router.post("/:id/villages", addVillageAllotment);
router.put("/:id/villages/:villageAllotmentId", updateVillageAllotment);

module.exports = router;

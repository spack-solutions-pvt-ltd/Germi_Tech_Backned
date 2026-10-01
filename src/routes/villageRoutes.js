"use strict";
const { Router } = require("express");
const {
  getVillageSummary,
  getAllVillages,
  getVillageById,
  createVillage,
  updateVillage,
  updatevillageStatusById,
} = require("../controller/villageController");
const {
  getSubOrganizersByVillageId,
} = require("../controller/subOrganizerController");

const router = Router();

router.post("/", createVillage);
router.get("/summary", getVillageSummary); // KPI cards — before /:villageId
router.get("/", getAllVillages);
router.get("/:villageId", getVillageById);
router.put("/:villageId", updateVillage);
router.patch("/status/:villageId", updatevillageStatusById);

// to get sub organizers of a particular village
router.get("/:villageId/sub-organizers", getSubOrganizersByVillageId);

module.exports = router;

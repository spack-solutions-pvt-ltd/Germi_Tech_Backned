"use strict";
const { Router } = require("express");
const { villageRoutes } = require("../constants/routes");
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

router.post(villageRoutes.root, createVillage);
router.get(villageRoutes.summary, getVillageSummary); // KPI cards — before /:villageId
router.get(villageRoutes.root, getAllVillages);
router.get(villageRoutes.byVillageId, getVillageById);
router.put(villageRoutes.byVillageId, updateVillage);
router.patch(villageRoutes.statusByVillageId, updatevillageStatusById);

// to get sub organizers of a particular village
router.get(villageRoutes.subOrganizersByVillageId, getSubOrganizersByVillageId);

module.exports = router;

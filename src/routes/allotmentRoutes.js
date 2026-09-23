"use strict";
const { Router } = require("express");
const {
  getAllAllotments,
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

router.get("/", getAllAllotments);
router.get("/village-table", getAllotmentVillageTable);
router.get("/:id", getAllotmentById);
router.post("/", createAllotment);
router.put("/:id", updateAllotment);
router.delete("/:id", deleteAllotment);

router.post("/:id/villages", addVillageAllotment);
router.put("/:id/villages/:villageAllotmentId", updateVillageAllotment);

// Route to get the allotments by their assigned user
router.get("/my-assignments", getMyAssignedAllotmentVillages);



module.exports = router;
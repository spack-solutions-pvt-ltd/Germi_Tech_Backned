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
} = require("../controller/allotmentController");

const router = Router();

router.get("/", getAllAllotments);
router.get("/village-table", getAllotmentVillageTable); // must come before /:id
router.get("/:id", getAllotmentById);
router.post("/", createAllotment);
router.put("/:id", updateAllotment);
router.delete("/:id", deleteAllotment);

router.post("/:id/villages", addVillageAllotment);
router.put("/:id/villages/:villageAllotmentId", updateVillageAllotment);

module.exports = router;
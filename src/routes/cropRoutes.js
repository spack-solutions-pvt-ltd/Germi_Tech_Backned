"use strict";
const { Router } = require("express");
const {
  getCropSummary,
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
  updateCropStatusById,
} = require("../controller/cropController");

const router = Router();

router.get("/summary", getCropSummary); // KPI cards — before /:cropId
router.get("/", getAllCrops);
router.get("/:cropId", getCropById);
router.post("/", createCrop);
router.put("/:cropId", updateCrop);
router.patch("/status/:cropId", updateCropStatusById);

module.exports = router;

"use strict";
const { Router } = require("express");
const {
  getAllCropVarieties,
  getCropVarietyById,
  createCropVariety,
  updateCropVariety,
  updateCropVarietieStatus,
} = require("../controller/companyCropVariety");

const router = Router();

router.get("/all/:companyId", getAllCropVarieties);
router.get("/:id", getCropVarietyById);
router.post("/", createCropVariety);
router.put("/:id", updateCropVariety);
router.patch("/status/:id", updateCropVarietieStatus);

module.exports = router;

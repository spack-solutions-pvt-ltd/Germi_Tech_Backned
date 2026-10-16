"use strict";
const { Router } = require("express");
const { cropRoutes } = require("../constants/routes");
const {
  getCropSummary,
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
  updateCropStatusById,
} = require("../controller/cropController");

const router = Router();

router.get(cropRoutes.summary, getCropSummary); // KPI cards — before /:cropId
router.get(cropRoutes.root, getAllCrops);
router.get(cropRoutes.byCropId, getCropById);
router.post(cropRoutes.root, createCrop);
router.put(cropRoutes.byCropId, updateCrop);
router.patch(cropRoutes.statusByCropId, updateCropStatusById);

module.exports = router;

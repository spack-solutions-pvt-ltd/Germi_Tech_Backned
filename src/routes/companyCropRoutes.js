"use strict";
const { Router } = require("express");
const { companyCropRoutes } = require("../constants/routes");
const {
  getAllCropVarieties,
  getCropVarietyById,
  createCropVariety,
  updateCropVariety,
  updateCropVarietieStatus,
} = require("../controller/companyCropVariety");

const router = Router();

router.get(companyCropRoutes.allByCompanyId, getAllCropVarieties);
router.get(companyCropRoutes.byId, getCropVarietyById);
router.post(companyCropRoutes.root, createCropVariety);
router.put(companyCropRoutes.byId, updateCropVariety);
router.patch(companyCropRoutes.statusById, updateCropVarietieStatus);

module.exports = router;

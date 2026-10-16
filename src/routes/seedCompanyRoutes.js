"use strict";
const { Router } = require("express");
const { seedCompanyRoutes } = require("../constants/routes");
const {
  getSeedCompanySummary,
  getAllSeedCompanies,
  getSeedCompanyById,
  createSeedCompany,
  updateSeedCompany,
} = require("../controller/seedCompanyController");

const router = Router();

router.get(seedCompanyRoutes.summary, getSeedCompanySummary); // KPI cards — before /:seedCompanyId
router.get(seedCompanyRoutes.root, getAllSeedCompanies);
router.get(seedCompanyRoutes.bySeedCompanyId, getSeedCompanyById);
router.post(seedCompanyRoutes.root, createSeedCompany);
router.put(seedCompanyRoutes.bySeedCompanyId, updateSeedCompany);

module.exports = router;

"use strict";
const { Router } = require("express");
const {
  getSeedCompanySummary,
  getAllSeedCompanies,
  getSeedCompanyById,
  createSeedCompany,
  updateSeedCompany,
} = require("../controller/seedCompanyController");

const router = Router();

router.get("/summary", getSeedCompanySummary); // KPI cards — before /:seedCompanyId
router.get("/", getAllSeedCompanies);
router.get("/:seedCompanyId", getSeedCompanyById);
router.post("/", createSeedCompany);
router.put("/:seedCompanyId", updateSeedCompany);

module.exports = router;

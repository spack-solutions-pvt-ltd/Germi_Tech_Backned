"use strict";
const { Router } = require("express");
const {
  getAllSeedCompanies,
  getSeedCompanyById,
  createSeedCompany,
  updateSeedCompany,
} = require("../controller/seedCompanyController");

const router = Router();

router.get("/", getAllSeedCompanies);
router.get("/:seedCompanyId", getSeedCompanyById);
router.post("/", createSeedCompany);
router.put("/:seedCompanyId", updateSeedCompany);

module.exports = router;

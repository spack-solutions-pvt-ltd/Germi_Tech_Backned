"use strict";
const { Router } = require("express");
const { authenticate } = require("../middleWare/authMiddleware");
const {
  getAllSeedCompanies,
  getSeedCompanyById,
  createSeedCompany,
  updateSeedCompany,
} = require("../controller/seedCompanyController");

const router = Router();

router.get("/", authenticate, getAllSeedCompanies);
router.get("/:seedCompanyId", authenticate, getSeedCompanyById);
router.post("/", authenticate, createSeedCompany);
router.put("/:seedCompanyId", authenticate, updateSeedCompany);

module.exports = router;

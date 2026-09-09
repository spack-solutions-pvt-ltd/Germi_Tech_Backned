"use strict";
const generateId = require("../utils/generateIds");
const { SeedCompany } = require("../models");
const {
  createSeedCompanySchema,
  updateSeedCompanySchema,
} = require("../validators/validator");

async function getAllSeedCompanies(req, res, next) {
  try {
    const seedCompanies = await SeedCompany.findAll();
    res.json({
      success: true,
      message: "seed Companies fetched successfully",
      data: seedCompanies,
    });
  } catch (err) {
    next(err);
  }
}

async function getSeedCompanyById(req, res) {
  try {
    const { seedCompanyId } = req.params;
    if (!seedCompanyId) {
      res.status(401).json({
        success: false,
        message: "seedCompanyId is required",
      });
    }
    const seedCompany = await SeedCompany.findByPk(seedCompanyId);
    if (!seedCompany)
      return res
        .status(404)
        .json({ success: false, message: "SeedCompany not found" });
    res.status(200).json({
      success: true,
      message: "SeedCompany fetched",
      data: seedCompany,
    });
  } catch (err) {
    next(err);
  }
}

async function createSeedCompany(req, res, next) {
  const parsed = createSeedCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const crop = await SeedCompany.create(parsed.data);
    const cropId = generateId("CR", crop.id);
    await crop.update({ cropId });
    res.status(201).json({
      success: true,
      message: "SeedCompany created",
      data: crop,
    });
  } catch (err) {
    next(err);
  }
}

async function updateSeedCompany(req, res) {
  const parsed = updateSeedCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(422)
      .json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const { seedCompanyId } = req.params;
    const seedCompany = await SeedCompany.findByPk(seedCompanyId);
    if (!seedCompany)
      return res.status(404).json({ message: "SeedCompany not found" });

    await seedCompany.update(parsed.data);
    res.json({
      success: true,
      message: "SeedCompany updated!",
      data: seedCompany,
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "A seedCompany with this name already exists" });
    }
    res
      .status(400)
      .json({ message: "Failed to update crop", error: err.message });
  }
}

module.exports = {
  getAllSeedCompanies,
  getSeedCompanyById,
  createSeedCompany,
  updateSeedCompany,
};

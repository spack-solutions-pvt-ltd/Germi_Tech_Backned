"use strict";
const generateId = require("../utils/generateIds");
const { Crop } = require("../models");
const {
  createCropSchema,
  updateCropSchema,
} = require("../validators/cropValidator");

async function getAllCrops(req, res, next) {
  try {
    const crops = await Crop.findAll({ order: [["name", "ASC"]] });
    res.json({
      success: true,
      message: "Crops fetched successfully",
      data: crops,
    });
  } catch (err) {
    next(err);
  }
}

async function getCropById(req, res) {
  try {
    const { cropId } = req.params;
    if (!cropId) {
      res.status(401).json({
        success: false,
        message: "cropId is required",
      });
    }
    const crop = await Crop.findByPk(cropId);
    if (!crop)
      return res
        .status(404)
        .json({ success: false, message: "Crop not found" });
    res
      .status(200)
      .json({ success: true, message: "Crop fetched", data: crop });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch crop", error: err.message });
  }
}

async function createCrop(req, res, next) {
  const parsed = createCropSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(422)
      .json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const crop = await Crop.create(parsed.data);
    const cropId = generateId("CR", crop.id);
    await crop.update({ cropId });
    res.status(201).json({
      success: true,
      message: "Crop created",
      data: crop,
    });
  } catch (err) {
    next(err);
  }
}

async function updateCrop(req, res) {
  const parsed = updateCropSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(422)
      .json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const { cropId } = req.params;
    const crop = await Crop.findByPk(cropId);
    if (!crop) return res.status(404).json({ message: "Crop not found" });

    await crop.update(parsed.data);
    res.json({ success: true, message: "Crop updated!", data: crop });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "A crop with this name already exists" });
    }
    res
      .status(400)
      .json({ message: "Failed to update crop", error: err.message });
  }
}

module.exports = { getAllCrops, getCropById, createCrop, updateCrop };

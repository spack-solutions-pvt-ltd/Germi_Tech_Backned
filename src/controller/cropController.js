"use strict";
const { generateId } = require("../utils/generateIds");
const { Crop } = require("../models");
const {
  createCropSchema,
  updateCropSchema,
} = require("../validators/cropValidator");

async function getAllCrops(req, res, next) {
  try {
    const { page, limit } = req.query;

    // No pagination parameters → return all crops
    if (page === undefined && limit === undefined) {
      const crops = await Crop.findAll({
        attributes: ["id", "name"],
        order: [["createdAt", "DESC"]],
      });

      return res.status(200).json({
        success: true,
        message: "Crops fetched successfully",
        data: crops,
      });
    }

    // Pagination parameters provided
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    // Validate pagination values
    if (
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "page and limit must be positive integers",
      });
    }

    const offset = (pageNumber - 1) * limitNumber;

    const { count, rows } = await Crop.findAndCountAll({
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Crops fetched successfully",
      data: rows,
      pagination: {
        total: count,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(count / limitNumber),
      },
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

const updateCropStatusById = async (req, res, next) => {
  try {
    const { cropId } = req.params;
    if (!cropId)
      return res
        .status(400)
        .json({ status: false, message: "cropId is required" });
    const crop = await Crop.findByPk(cropId);
    if (!crop)
      return res
        .status(404)
        .json({ success: false, message: "Crop not found" });
    await crop.update({ status: req.body.status });
    return res
      .status(200)
      .json({ success: true, message: "Status updated successfully!" });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
  updateCropStatusById,
};

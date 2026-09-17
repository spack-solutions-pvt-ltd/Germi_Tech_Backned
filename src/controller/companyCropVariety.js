"use strict";
const { Op } = require("sequelize");
const { CompanyCrop, SeedCompany, Crop } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/**
 * "Crop varieties" — one row per crop+variety a specific company offers.
 * Backed by the CompanyCrop model.
 */

/** GET /api/crop-varieties?companyId=3&cropId=5&search=hybrid&page=1&limit=20 */
async function getAllCropVarieties(req, res, next) {
  try {
    const { companyId } = req.params;
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (companyId) where.companyId = companyId;
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { varietyName: { [Op.like]: term } },
        { companyCropId: { [Op.like]: term } },
        { "$crop.name$": { [Op.like]: term } },
      ];
    }

    const result = await CompanyCrop.findAndCountAll({
      where,
      include: [
        { model: Crop, as: "crop", attributes: ["id", "cropId", "name"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Crop varieties fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/crop-varieties/:id */
async function getCropVarietyById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const cropVariety = await CompanyCrop.findByPk(id);
    if (!cropVariety) return error(res, 404, "Crop variety not found");

    return success(res, 200, "Crop variety fetched successfully", {
      data: cropVariety,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/crop-varieties */
async function createCropVariety(req, res, next) {
  try {
    const { companyId, cropId, varietyName, status } = req.body;

    if (!companyId) return error(res, 400, "companyId is required");
    if (!cropId) return error(res, 400, "cropId is required");
    if (!varietyName) return error(res, 400, "varietyName is required");

    const [company, crop] = await Promise.all([
      SeedCompany.findByPk(companyId),
      Crop.findByPk(cropId),
    ]);
    if (!company) return error(res, 404, "Seed company not found");
    if (!crop) return error(res, 404, "Crop not found");

    const cropVariety = await CompanyCrop.create({
      companyId,
      cropId,
      varietyName,
      status: status || "Active",
    });

    const companyCropId = generateId("SDV", cropVariety?.id);
    await cropVariety.update({ companyCropId });
    return success(res, 201, "Crop variety created successfully", {
      data: cropVariety,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT/PATCH /api/crop-varieties/:id */
async function updateCropVariety(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const cropVariety = await CompanyCrop.findByPk(id);
    if (!cropVariety) return error(res, 404, "Crop variety not found");

    const { varietyName, status, cropId } = req.body;

    await cropVariety.update({
      ...(varietyName !== undefined && { varietyName }),
      ...(status !== undefined && { status }),
      ...(cropId !== undefined && { cropId }),
    });

    return success(res, 200, "Crop variety updated successfully", {
      data: cropVariety,
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return error(
        res,
        409,
        "This company already has this crop/variety combination",
      );
    }
    next(err);
  }
}

const updateCropVarietieStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id) return error(res, 400, "Seed varieties id is required");
    if (!status) return error(res, 400, "status is required");

    const company = await CompanyCrop.findByPk(id);
    if (!company) return error(res, 404, "Company crop not found");
    await company.update({ status });
    return success(res, 200, "CompanyCrop status updated successfully", {
      data: company,
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getAllCropVarieties,
  getCropVarietyById,
  createCropVariety,
  updateCropVariety,
  updateCropVarietieStatus,
};

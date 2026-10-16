"use strict";
const { Op } = require("sequelize");
const { CompanyCrop, SeedCompany, Crop } = require("../models");
const {
  getPagination,
  hasPagination,
  statusFilter,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");
const { companyCropVarietyMessages } = require("../constants/message/companyCropVarietyMessages");

/**
 * "Crop varieties" — one row per crop+variety a specific company offers.
 * Backed by the CompanyCrop model.
 */

/** GET /api/crop-varieties?companyId=3&cropId=5&search=hybrid&page=1&limit=20 */
async function getAllCropVarieties(req, res, next) {
  try {
    const { companyId } = req.params;
    const { search, status } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = statusFilter(status); // ?status=Active|Inactive
    if (companyId) where.companyId = companyId;
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { varietyName: { [Op.like]: term } },
        { companyCropId: { [Op.like]: term } },
        { "$crop.name$": { [Op.like]: term } },
      ];
    }

    // No page/limit: every match as { id, companyCropId, varietyName, crop } for dropdowns.
    if (!hasPagination(req.query)) {
      const data = await CompanyCrop.findAll({
        where,
        attributes: ["id", "companyCropId", "varietyName", "status"],
        include: [
          { model: Crop, as: "crop", attributes: ["id", "cropId", "name"] },
        ],
        order: [["createdAt", "DESC"]],
      });
      return success(res, 200, companyCropVarietyMessages.cropFetchSuccess, { data });
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
      companyCropVarietyMessages.cropFetchSuccess,
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
    if (!id) return error(res, 400, companyCropVarietyMessages.idRequired);

    const cropVariety = await CompanyCrop.findByPk(id);
    if (!cropVariety) return error(res, 404, companyCropVarietyMessages.cropVarietyNotFound);

    return success(res, 200, companyCropVarietyMessages.getCropSuccess, {
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

    if (!companyId) return error(res, 400, companyCropVarietyMessages.companyIdReq);
    if (!cropId) return error(res, 400, companyCropVarietyMessages.cropIdReq);
    if (!varietyName) return error(res, 400, companyCropVarietyMessages.varietyNameReq);

    const [company, crop] = await Promise.all([
      SeedCompany.findByPk(companyId),
      Crop.findByPk(cropId),
    ]);
    if (!company) return error(res, 404, companyCropVarietyMessages.seedComNotFound);
    if (!crop) return error(res, 404, companyCropVarietyMessages.cropNotFound);

    const cropVariety = await CompanyCrop.create({
      companyId,
      cropId,
      varietyName,
      status: status || "Active",
    });

    const companyCropId = generateId("SDV", cropVariety?.id);
    await cropVariety.update({ companyCropId });
    return success(res, 201, companyCropVarietyMessages.createMessage, {
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
    if (!id) return error(res, 400, companyCropVarietyMessages.idRequired);

    const cropVariety = await CompanyCrop.findByPk(id);
    if (!cropVariety) return error(res, 404, companyCropVarietyMessages.cropVarietyNotFound);

    const { varietyName, status, cropId } = req.body;

    await cropVariety.update({
      ...(varietyName !== undefined && { varietyName }),
      ...(status !== undefined && { status }),
      ...(cropId !== undefined && { cropId }),
    });

    return success(res, 200, companyCropVarietyMessages.updatedMessage, {
      data: cropVariety,
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return error(
        res,
        409,
        companyCropVarietyMessages.cropVarietyFound,
      );
    }
    next(err);
  }
}

const updateCropVarietieStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id) return error(res, 400, companyCropVarietyMessages.seedVarietyIdReq);
    if (!status) return error(res, 400, companyCropVarietyMessages.statusReqMsg);

    const company = await CompanyCrop.findByPk(id);
    if (!company) return error(res, 404, companyCropVarietyMessages.companyCropNotFound);
    await company.update({ status });
    return success(res, 200, companyCropVarietyMessages.companyStatusUpdateMsg, {
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

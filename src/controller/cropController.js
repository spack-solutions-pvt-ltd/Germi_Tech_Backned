"use strict";
const { generateId } = require("../utils/generateIds");
const { sequelize, Crop, CompanyCrop } = require("../models");
const { statusFilter } = require("../utils/pagination");
const {
  createCropSchema,
  updateCropSchema,
} = require("../validators/cropValidator");
const { Op } = require("sequelize");
const { cropMessages } = require("../constants/message/cropMessages");

async function getAllCrops(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const where = statusFilter(req.query.status); // ?status=Active|Inactive
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { cropId: { [Op.like]: term } },
      ];
    }

    // No pagination parameters → return all crops as { id, cropId, name }
    if (page === undefined && limit === undefined) {
      const crops = await Crop.findAll({
        where,
        attributes: ["id", "cropId", "name"],
        order: [["createdAt", "DESC"]],
      });

      return res.status(200).json({
        success: true,
        message: cropMessages.cropFetchMsg,
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
        message: cropMessages.pageAndLimitMustBePositive,
      });
    }

    const offset = (pageNumber - 1) * limitNumber;

    const { count, rows } = await Crop.findAndCountAll({
      where,
      attributes: {
        include: [
          [
            // "Associated varieties" — company varieties mapped to this crop.
            sequelize.literal(
              "(SELECT COUNT(*) FROM `company_crops` AS cc WHERE cc.cropId = `Crop`.id)",
            ),
            "varietyCount",
          ],
        ],
      },
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: cropMessages.cropFetchMsg,
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
        message: cropMessages.cropIdReqMsg,
      });
    }
    const crop = await Crop.findByPk(cropId);
    if (!crop)
      return res
        .status(404)
        .json({ success: false, message: cropMessages.cropNotFound });
    res
      .status(200)
      .json({ success: true, message: cropMessages.cropFetchMsgById, data: crop });
  } catch (err) {
    res
      .status(500)
      .json({ message: cropMessages.failedToFetchMsg, error: err.message });
  }
}

async function createCrop(req, res, next) {
  const parsed = createCropSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(422)
      .json({ message: cropMessages.validationFailed, errors: parsed.error.flatten() });
  }

  try {
    const crop = await Crop.create(parsed.data);
    const cropId = generateId("CR", crop.id);
    await crop.update({ cropId });
    res.status(201).json({
      success: true,
      message: cropMessages.cropCreated,
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
      .json({ message: cropMessages.validationFailed, errors: parsed.error.flatten() });
  }

  try {
    const { cropId } = req.params;
    const crop = await Crop.findByPk(cropId);
    if (!crop) return res.status(404).json({ message: cropMessages.cropNotFound });

    await crop.update(parsed.data);
    res.json({ success: true, message: cropMessages.cropUpdated, data: crop });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: cropMessages.aCropWithThisNameAlready });
    }
    res
      .status(400)
      .json({ message: cropMessages.failedToUpdateCrop, error: err.message });
  }
}

const updateCropStatusById = async (req, res, next) => {
  try {
    const { cropId } = req.params;
    if (!cropId)
      return res
        .status(400)
        .json({ status: false, message: cropMessages.cropIdReqMsg });
    const crop = await Crop.findByPk(cropId);
    if (!crop)
      return res
        .status(404)
        .json({ success: false, message: cropMessages.cropNotFound });
    await crop.update({ status: req.body.status });
    return res
      .status(200)
      .json({ success: true, message: cropMessages.statusUpdatedSuccessfully });
  } catch (error) {
    next(error);
  }
};
/**
 * GET /crop/summary — Crops page KPI cards.
 * totalVarieties counts every seed-company variety (CompanyCrop) across all crops.
 */
async function getCropSummary(req, res, next) {
  try {
    const [totalCrops, activeCrops, totalVarieties] = await Promise.all([
      Crop.count(),
      Crop.count({ where: { status: "Active" } }),
      CompanyCrop.count(),
    ]);

    return res.status(200).json({
      success: true,
      message: cropMessages.cropSummaryFetchedSuccessfully,
      data: {
        totalCrops,
        activeCrops,
        inactiveCrops: totalCrops - activeCrops,
        totalVarieties,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCropSummary,
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
  updateCropStatusById,
};

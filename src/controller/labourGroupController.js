"use strict";
const { Op } = require("sequelize");
const {
  LaborGroup,
  LaborGroupCropRate,
  Crop,
  Employee,
  sequelize,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/** GET /api/labor-groups */
async function getAllLaborGroups(req, res, next) {
  try {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      where[Op.or] = [
        sequelizeWhere(fn("LOWER", col("name")), {
          [Op.like]: term,
        }),
        sequelizeWhere(fn("LOWER", col("laborGroupId")), {
          [Op.like]: term,
        }),
      ];
    }

    const result = await LaborGroup.findAndCountAll({
      where,
      include: [
        {
          model: LaborGroupCropRate,
          as: "cropRates",
          attributes: ["id", "cropId", "pricePerPerson", "laborGroupId"],
          include: {
            model: Crop,
            as: "crop",
            attributes: ["id", "cropId", "name"],
          },
        },
      ],
      distinct: true,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Labor groups fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/labor-groups/:id */
async function getLaborGroupById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const laborGroup = await LaborGroup.findByPk(id, {
      include: [
        {
          model: LaborGroupCropRate,
          as: "cropRates",
          include: { model: Crop, as: "crop" },
        },
        { model: Employee, as: "creator", attributes: ["id", "empId", "name"] },
      ],
    });

    if (!laborGroup) return error(res, 404, "Labor group not found");

    return success(res, 200, "Labor group fetched successfully", {
      data: laborGroup,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/labor-groups
 */
async function createLaborGroup(req, res, next) {
  const transaction = await sequelize.transaction();

  try {
    const { name, contactNumber, upiNumber, status, cropRates = [] } = req.body;

    if (!name) {
      await transaction.rollback();
      return error(res, 400, "name is required");
    }

    if (!contactNumber) {
      await transaction.rollback();
      return error(res, 400, "contactNumber is required");
    }

    // Validate crop rates
    if (cropRates.length) {
      for (const rate of cropRates) {
        if (!rate.cropId) {
          await transaction.rollback();
          return error(res, 400, "cropId is required in every cropRates entry");
        }

        if (rate.pricePerPerson === undefined) {
          await transaction.rollback();
          return error(
            res,
            400,
            "pricePerPerson is required in every cropRates entry",
          );
        }
      }

      // Check duplicate crop IDs in request
      const cropIds = cropRates.map((r) => Number(r.cropId));

      const uniqueCropIds = new Set(cropIds);

      if (uniqueCropIds.size !== cropIds.length) {
        await transaction.rollback();

        return error(
          res,
          400,
          "Same crop cannot be added more than once to the same labor group",
        );
      }

      // Check whether crops actually exist
      const crops = await Crop.findAll({
        where: {
          id: cropIds,
        },
        transaction,
      });

      if (crops.length !== uniqueCropIds.size) {
        await transaction.rollback();

        return error(
          res,
          404,
          "One or more cropId values in cropRates do not exist",
        );
      }
    }

    const createdBy = req.employee ? req.employee.id : null;

    // Create Labor Group
    const laborGroup = await LaborGroup.create(
      {
        name,
        contactNumber,
        upiNumber,
        createdBy,
        status: status || "Active",
      },
      {
        transaction,
      },
    );

    // Generate labor group ID
    const laborGroupId = generateId("LB", laborGroup.id);

    await laborGroup.update(
      {
        laborGroupId,
      },
      {
        transaction,
      },
    );

    // Create crop rates
    if (cropRates.length) {
      await LaborGroupCropRate.bulkCreate(
        cropRates.map((r) => ({
          laborGroupId: laborGroup.id,
          cropId: r.cropId,
          pricePerPerson: r.pricePerPerson,
        })),
        {
          transaction,
        },
      );
    }

    // Get created data before commit
    const created = await LaborGroup.findByPk(laborGroup.id, {
      include: [
        {
          model: LaborGroupCropRate,
          as: "cropRates",
          include: {
            model: Crop,
            as: "crop",
          },
        },
      ],
      transaction,
    });

    // Everything succeeded
    await transaction.commit();

    return success(res, 201, "Labor group created successfully", {
      data: created,
    });
  } catch (err) {
    // Anything fails -> rollback everything
    await transaction.rollback();

    next(err);
  }
}

/**
 * PUT/PATCH /api/labor-groups/:id
 */
async function updateLaborGroup(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const laborGroup = await LaborGroup.findByPk(id);
    if (!laborGroup) return error(res, 404, "Labor group not found");

    const { name, contactNumber, upiNumber, status, cropRates } = req.body;

    if (cropRates !== undefined) {
      for (const rate of cropRates) {
        if (!rate.cropId)
          return error(res, 400, "cropId is required in every cropRates entry");
        if (rate.pricePerPerson === undefined) {
          return error(
            res,
            400,
            "pricePerPerson is required in every cropRates entry",
          );
        }
      }

      const cropIds = cropRates.map((r) => r.cropId);
      const crops = await Crop.findAll({ where: { id: cropIds } });
      if (crops.length !== new Set(cropIds).size) {
        return error(
          res,
          404,
          "One or more cropId values in cropRates do not exist",
        );
      }

      await LaborGroupCropRate.destroy({ where: { laborGroupId: id } });
      if (cropRates.length) {
        await LaborGroupCropRate.bulkCreate(
          cropRates.map((r) => ({
            laborGroupId: id,
            cropId: r.cropId,
            pricePerPerson: r.pricePerPerson,
          })),
        );
      }
    }

    await laborGroup.update({
      ...(name !== undefined && { name }),
      ...(contactNumber !== undefined && { contactNumber }),
      ...(upiNumber !== undefined && { upiNumber }),
      ...(status !== undefined && { status }),
    });

    const updated = await LaborGroup.findByPk(id, {
      include: [
        {
          model: LaborGroupCropRate,
          as: "cropRates",
          include: { model: Crop, as: "crop" },
        },
      ],
    });

    return success(res, 200, "Labor group updated successfully", {
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllLaborGroups,
  getLaborGroupById,
  createLaborGroup,
  updateLaborGroup,
};

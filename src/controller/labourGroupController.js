"use strict";
const { Op } = require("sequelize");
const {
  LaborGroup,
  LaborGroupCropRate,
  Crop,
  Employee,
  Payment,
  LabourRequest,
  sequelize,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");
const { startOfCurrentMonth, resolveSeason, toDateOnly } = require("../utils/periods");

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

const LABOUR_PAYMENT_WHERE = { type: "labour", recipientType: "labor_group" };
const PERSON_ATTRS = ["id", "empId", "name", "level"];

/** Sum of payment amounts matching `where` (0 when none). */
async function sumPayments(where) {
  return Number(await Payment.sum("amount", { where })) || 0;
}

/**
 * GET /labour-groups/summary?season=&year= — Labour groups page KPI cards.
 * wagesDue       = labour payments still pending
 * paidThisSeason = labour payments processed with a payment date in the
 *                  season (current season unless ?season=&year= is given)
 */
async function getLaborGroupSummary(req, res, next) {
  try {
    const season = resolveSeason(req.query);

    const [totalGroups, addedThisMonth, wagesDue, pendingPayments, paidThisSeason] = await Promise.all([
      LaborGroup.count(),
      LaborGroup.count({ where: { createdAt: { [Op.gte]: startOfCurrentMonth() } } }),
      sumPayments({ ...LABOUR_PAYMENT_WHERE, status: "pending" }),
      Payment.count({ where: { ...LABOUR_PAYMENT_WHERE, status: "pending" } }),
      sumPayments({
        ...LABOUR_PAYMENT_WHERE,
        status: "processed",
        paymentDate: { [Op.gte]: toDateOnly(season.start), [Op.lt]: toDateOnly(season.end) },
      }),
    ]);

    return success(res, 200, "Labour group summary fetched successfully", {
      data: { totalGroups, addedThisMonth, wagesDue, pendingPayments, paidThisSeason, season: season.label },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /labour-groups/:id/payments?page=&limit=&status=pending|processed
 * Payments history for one labour group, plus its wagesDue (pending) and
 * paidTotal (processed) for the details card.
 * Each row: paymentCode, requestedBy (supervisor who raised the labour
 * request), approvedBy (who created the payment), processedBy, amount,
 * date, mode, status, sourceCode.
 */
async function getLaborGroupPayments(req, res, next) {
  try {
    const group = await LaborGroup.findByPk(req.params.id, { attributes: ["id"] });
    if (!group) return error(res, 404, "Labour group not found");

    const groupWhere = { recipientType: "labor_group", recipientId: group.id };
    const where = { ...groupWhere };
    if (["pending", "processed"].includes(req.query.status)) where.status = req.query.status;

    const { page, limit, offset } = getPagination(req.query);
    const [result, wagesDue, paidTotal] = await Promise.all([
      Payment.findAndCountAll({
        where,
        include: [
          { model: Employee, as: "creator", attributes: PERSON_ATTRS },
          { model: Employee, as: "processor", attributes: PERSON_ATTRS },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      sumPayments({ ...groupWhere, status: "pending" }),
      sumPayments({ ...groupWhere, status: "processed" }),
    ]);

    // "Requested by" = the supervisor on the labour request each payment came from.
    const requestIds = result.rows
      .filter((p) => p.sourceRequestType === "labour_request")
      .map((p) => p.sourceRequestId);
    const requests = requestIds.length
      ? await LabourRequest.findAll({
          where: { id: requestIds },
          attributes: ["id", "requestCode"],
          include: { model: Employee, as: "requester", attributes: PERSON_ATTRS },
        })
      : [];
    const requestById = new Map(requests.map((r) => [r.id, r]));

    const response = buildPaginatedResponse(result, page, limit);
    response.data = result.rows.map((p) => {
      const request = requestById.get(p.sourceRequestId);
      return {
        id: p.id,
        paymentCode: p.paymentCode,
        sourceCode: request?.requestCode || null,
        requestedBy: request?.requester || null,
        approvedBy: p.creator,
        processedBy: p.processor,
        amount: p.amount,
        status: p.status,
        paymentMode: p.paymentMode,
        referenceId: p.referenceId,
        date: p.status === "processed" ? p.paymentDate : p.createdAt,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
      };
    });
    response.totals = { wagesDue, paidTotal };

    return success(res, 200, "Labour group payments fetched successfully", response);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLaborGroupSummary,
  getLaborGroupPayments,
  getAllLaborGroups,
  getLaborGroupById,
  createLaborGroup,
  updateLaborGroup,
};

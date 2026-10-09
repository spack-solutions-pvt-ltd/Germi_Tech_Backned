"use strict";
const { Op } = require("sequelize");
const {
  LaborGroup,
  LaborGroupCropRate,
  Crop,
  Employee,
  Payment,
  LabourRequest,
  LabourRequestCropEntry,
  sequelize,
} = require("../models");
const {
  getPagination,
  hasPagination,
  statusFilter,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");
const { calculateLabourCost } = require("../utils/labourCost");
const { allotmentVillageInclude } = require("../utils/bagsCommon");
const {
  startOfCurrentMonth,
  resolveSeason,
  seasonFilter,
  paymentSeasonWhere,
  toDateOnly,
} = require("../utils/periods");

/** GET /api/labor-groups */
async function getAllLaborGroups(req, res, next) {
  try {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = statusFilter(req.query.status); // ?status=Active|Inactive
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { laborGroupId: { [Op.like]: term } },
      ];
    }
    
    // No page/limit: every match as { id, laborGroupId, name } for dropdowns.
    if (!hasPagination(req.query)) {
      const data = await LaborGroup.findAll({
        where,
        attributes: ["id", "laborGroupId", "name"],
        order: [["createdAt", "DESC"]],
      });
      return success(res, 200, "Labor groups fetched successfully", { data });
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

    const totals = await getGroupPaymentTotals(laborGroup.id, resolveSeason(req.query));

    return success(res, 200, "Labor group fetched successfully", {
      data: { ...laborGroup.toJSON(), ...totals },
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
 * One group's payment totals for the details card:
 *   wagesDue       — its payments still pending
 *   paidThisSeason — processed with a payment date inside `season`
 *   paidTotal      — processed, all time
 */
async function getGroupPaymentTotals(groupId, season) {
  const groupWhere = { recipientType: "labor_group", recipientId: groupId };
  const [wagesDue, paidThisSeason, paidTotal] = await Promise.all([
    sumPayments({ ...groupWhere, status: "pending" }),
    sumPayments({
      ...groupWhere,
      status: "processed",
      paymentDate: { [Op.gte]: toDateOnly(season.start), [Op.lt]: toDateOnly(season.end) },
    }),
    sumPayments({ ...groupWhere, status: "processed" }),
  ]);
  return { wagesDue, paidThisSeason, paidTotal, season: season.label };
}

/**
 * GET /labour-groups/summary?season=Kharif|Rabi&year=2026 — Labour groups page KPI cards.
 * wagesDue / pendingPayments = labour payments still pending (raised in the season)
 * paidThisSeason             = labour payments processed (paid in the season)
 * Without season / year the payment figures cover all time (see seasonFilter).
 */
async function getLaborGroupSummary(req, res, next) {
  try {
    const season = seasonFilter(req.query);
    const inSeason = paymentSeasonWhere(season);

    const [totalGroups, addedThisMonth, wagesDue, pendingPayments, paidThisSeason] = await Promise.all([
      LaborGroup.count(),
      LaborGroup.count({ where: { createdAt: { [Op.gte]: startOfCurrentMonth() } } }),
      sumPayments({ ...LABOUR_PAYMENT_WHERE, status: "pending", ...inSeason }),
      Payment.count({ where: { ...LABOUR_PAYMENT_WHERE, status: "pending", ...inSeason } }),
      sumPayments({ ...LABOUR_PAYMENT_WHERE, status: "processed", ...inSeason }),
    ]);

    return success(res, 200, "Labour group summary fetched successfully", {
      data: {
        totalGroups,
        addedThisMonth,
        wagesDue,
        pendingPayments,
        paidThisSeason,
        season: season ? season.label : "All time",
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /labour-groups/:id/payments?page=&limit=&status=pending|processed
 * Payments history for one labour group, plus `totals`
 * { wagesDue, paidThisSeason, paidTotal, season } (see getGroupPaymentTotals).
 * Each row: paymentCode, requestedBy (supervisor who raised the labour
 * request), approvedBy (who created the payment), processedBy, amount,
 * date, mode, status, sourceCode.
 */
/**
 * GET /labour-groups/:id/payments/:paymentId — the payment drawer:
 * wage breakdown of one settlement for this labour group.
 *   numberOfMembers  Σ labourCount of the labour request's crop rows
 *   pricePerPerson   the group's crop rate (null when crops have different
 *                    rates — see cropBreakdown for each one)
 *   transportCharges transportCost set at verification / approval
 *   totalAmount      what the payment is for (the Payment amount)
 *   referenceNo      payment reference ID (once processed)
 *   requestedDate    when the labour request was raised
 */
async function getLaborGroupPaymentById(req, res, next) {
  try {
    const payment = await Payment.findOne({
      where: { id: req.params.paymentId, recipientType: "labor_group", recipientId: req.params.id },
      include: [
        { model: Employee, as: "creator", attributes: PERSON_ATTRS },
        { model: Employee, as: "processor", attributes: PERSON_ATTRS },
      ],
    });
    if (!payment) return error(res, 404, "Payment not found for this labour group");

    const request =
      payment.sourceRequestType === "labour_request"
        ? await LabourRequest.findByPk(payment.sourceRequestId, {
            include: [
              { model: Employee, as: "requester", attributes: PERSON_ATTRS },
              {
                model: LabourRequestCropEntry,
                as: "cropEntries",
                include: allotmentVillageInclude("allotmentVillage"),
              },
            ],
          })
        : null;

    const cost = request ? await calculateLabourCost(request) : null;
    const prices = [...new Set((cost?.cropCosts || []).map((c) => c.pricePerPerson).filter((p) => p !== null))];

    return success(res, 200, "Labour group payment fetched successfully", {
      data: {
        id: payment.id,
        paymentCode: payment.paymentCode,
        status: payment.status,
        sourceCode: request?.requestCode || null,

        numberOfMembers: (cost?.cropCosts || []).reduce((sum, c) => sum + c.labourCount, 0),
        pricePerPerson: prices.length === 1 ? prices[0] : null,
        cropBreakdown: (cost?.cropCosts || []).map(({ cropName, labourCount, pricePerPerson, subtotal }) => ({
          cropName,
          labourCount,
          pricePerPerson,
          subtotal,
        })),
        labourCost: cost?.labourCostSubtotal ?? null,
        transportCharges: cost?.transportCost ?? 0,
        totalAmount: Number(payment.amount),

        referenceNo: payment.referenceId,
        paymentMode: payment.paymentMode,
        paymentDate: payment.paymentDate,
        requestedDate: request?.createdAt || null,

        requestedBy: request?.requester || null,
        approvedBy: payment.creator,
        processedBy: payment.processor,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getLaborGroupPayments(req, res, next) {
  try {
    const group = await LaborGroup.findByPk(req.params.id, { attributes: ["id"] });
    if (!group) return error(res, 404, "Labour group not found");

    const where = { recipientType: "labor_group", recipientId: group.id, ...paymentSeasonWhere(seasonFilter(req.query)) };
    if (["pending", "processed"].includes(req.query.status)) where.status = req.query.status;

    const { page, limit, offset } = getPagination(req.query);
    const [result, totals] = await Promise.all([
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
      getGroupPaymentTotals(group.id, resolveSeason(req.query)),
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
    response.totals = totals;

    return success(res, 200, "Labour group payments fetched successfully", response);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLaborGroupSummary,
  getLaborGroupPayments,
  getLaborGroupPaymentById,
  getAllLaborGroups,
  getLaborGroupById,
  createLaborGroup,
  updateLaborGroup,
};

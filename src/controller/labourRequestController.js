"use strict";
const {
  LabourRequest,
  LabourRequestCropEntry,
  AllotmentVillage,
  Allotment,
  CompanyCrop,
  Crop,
  Village,
  LaborGroup,
  LaborGroupCropRate,
  Employee,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");
const { createPaymentIfNeeded } = require("../utils/createPayment");

const ENTRY_INCLUDE = {
  model: LabourRequestCropEntry,
  as: "cropEntries",
  include: {
    model: AllotmentVillage,
    as: "allotmentVillage",
    include: [
      { model: Village, as: "village", attributes: ["id", "name"] },
      {
        model: Allotment,
        as: "allotment",
        attributes: ["id", "allotmentId"],
        include: {
          model: CompanyCrop,
          as: "companyCrop",
          attributes: ["id", "cropId", "varietyName"],
          include: { model: Crop, as: "crop", attributes: ["id", "name"] },
        },
      },
    ],
  },
};

const HEADER_INCLUDES = [
  {
    model: Employee,
    as: "requester",
    attributes: ["id", "empId", "name", "level"],
  },
  { model: Employee, as: "verifier", attributes: ["id", "empId", "name"] },
  { model: Employee, as: "approver", attributes: ["id", "empId", "name"] },
  { model: Employee, as: "rejecter", attributes: ["id", "empId", "name"] },
  {
    model: LaborGroup,
    as: "laborGroup",
    attributes: ["id", "laborGroupId", "name"],
  },
];

/** Shared list logic — `where` is built by the caller so "mine" vs "everyone's" can differ. */
async function listLabourRequests(where, req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;
    if (status) where.status = status;

    const result = await LabourRequest.findAndCountAll({
      where,
      include: HEADER_INCLUDES,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Labour requests fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/labour-requests/my-requests — the L3 "Requests" tab: own requests only */
async function getMyLabourRequests(req, res, next) {
    return listLabourRequests({ requestedBy: req.employee.id }, req, res, next);
}

/** GET /api/labour-requests — Verifications/Approvals: every supervisor's requests */
async function getAllLabourRequests(req, res, next) {
  const { requestedBy } = req.query;
  const where = {};
  if (requestedBy) where.requestedBy = requestedBy;
  return listLabourRequests(where, req, res, next);
}

/** GET /api/labour-requests/:id */
async function getLabourRequestById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const request = await LabourRequest.findByPk(id, {
      include: [...HEADER_INCLUDES, ENTRY_INCLUDE],
    });
    if (!request) return error(res, 404, "Labour request not found");

    return success(res, 200, "Labour request fetched successfully", {
      data: request,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/labour-requests (multipart/form-data)
 * fields: laborGroupId | otherLaborGroupName, fromLocation, toLocation,
 *         transportType, notes,
 *         cropEntries (JSON string): [{ allotmentVillageId, labourCount, totalAcres, acresWorked, rowingTime }],
 *         requestedBy (optional — see "create on behalf of" below)
 * files:  start_photo, end_photo (each optional, single file)
 *
 */
async function createLabourRequest(req, res, next) {
  try {
    
    const {
      laborGroupId,
      otherLaborGroupName,
      fromLocation,
      toLocation,
      transportType,
      notes,
    } = req.body;

    let cropEntries;
    try {
      cropEntries =
        typeof req.body.cropEntries === "string"
          ? JSON.parse(req.body.cropEntries)
          : req.body.cropEntries;
    } catch {
      return error(res, 400, "cropEntries must be valid JSON");
    }
    cropEntries = cropEntries || [];

    if (!laborGroupId && !otherLaborGroupName) {
      return error(
        res,
        400,
        "Either laborGroupId or otherLaborGroupName is required",
      );
    }
    if (!fromLocation) return error(res, 400, "fromLocation is required");
    if (!toLocation) return error(res, 400, "toLocation is required");
    if (!cropEntries.length)
      return error(res, 400, "At least one crop entry is required");

    if (laborGroupId) {
      const laborGroup = await LaborGroup.findByPk(laborGroupId);
      if (!laborGroup) return error(res, 404, "Labor group not found");
    }

    // Resolve who this request is FOR. Defaults to the caller; an L1/L2 can
    // raise it for a different supervisor by passing requestedBy.
    let requestedBy = req.employee.id;
    const { requestedBy: onBehalfOf } = req.body;
    if (onBehalfOf && Number(onBehalfOf) !== req.employee.id) {
      if (!["L1", "L2"].includes(req.employee.level)) {
        return error(
          res,
          403,
          "Only L1 or L2 employees can create a request on behalf of someone else",
        );
      }
      const targetEmployee = await Employee.findByPk(onBehalfOf);
      if (!targetEmployee)
        return error(res, 404, "requestedBy employee not found");
      requestedBy = Number(onBehalfOf);
    }

    // Every allotmentVillageId must belong to whoever the request is FOR —
    // not necessarily the person submitting the form.
    for (const entry of cropEntries) {
      if (!entry.allotmentVillageId)
        return error(
          res,
          400,
          "allotmentVillageId is required in every crop entry",
        );
      if (!entry.labourCount)
        return error(res, 400, "labourCount is required in every crop entry");

      const av = await AllotmentVillage.findByPk(entry.allotmentVillageId);
      if (!av)
        return error(
          res,
          404,
          `AllotmentVillage ${entry.allotmentVillageId} not found`,
        );
      if (av.supervisorId !== requestedBy) {
        return error(
          res,
          403,
          `Employee ${requestedBy} is not the assigned supervisor for allotmentVillageId ${entry.allotmentVillageId}`,
        );
      }
    }

    const startPhoto = req.files?.start_photo?.[0];
    const endPhoto = req.files?.end_photo?.[0];

    const labourRequest = await LabourRequest.create({
      requestedBy,
      createdBy: req.employee.id,
      laborGroupId: laborGroupId || null,
      otherLaborGroupName: laborGroupId ? null : otherLaborGroupName,
      fromLocation,
      toLocation,
      startPhotoUrl: startPhoto
        ? `/uploads/labour-requests/${startPhoto.filename}`
        : null,
      endPhotoUrl: endPhoto
        ? `/uploads/labour-requests/${endPhoto.filename}`
        : null,
      transportType,
      notes,
      status: "pending",
    });
    const requestCode = await generateId("LR", labourRequest?.id);
    await labourRequest.update({ requestCode });

    await LabourRequestCropEntry.bulkCreate(
      cropEntries.map((e) => ({
        labourRequestId: labourRequest.id,
        allotmentVillageId: e.allotmentVillageId,
        labourCount: e.labourCount,
        totalAcres: e.totalAcres,
        acresWorked: e.acresWorked,
        rowingTime: e.rowingTime,
      })),
    );

    const created = await LabourRequest.findByPk(labourRequest.id, {
      include: [...HEADER_INCLUDES, ENTRY_INCLUDE],
    });

    return success(res, 201, "Labour request created successfully", {
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/labour-requests/:id (multipart/form-data)
 * Editable ONLY while status is "pending" — once L2 verifies it, the
 * numbers/details are locked. Same fields as create, all optional; only
 * what's provided gets changed. Sending a new start_photo/end_photo
 * replaces the old one. cropEntries, if provided, REPLACES the full set.
 */
async function updateLabourRequest(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const request = await LabourRequest.findByPk(id);
    if (!request) return error(res, 404, "Labour request not found");

    if (request.status !== "pending") {
      return error(
        res,
        409,
        "Labour requests can only be edited while Pending (not yet verified)",
      );
    }

    const {
      laborGroupId,
      otherLaborGroupName,
      fromLocation,
      toLocation,
      transportType,
      notes,
    } = req.body;

    if (laborGroupId !== undefined) {
      const laborGroup = await LaborGroup.findByPk(laborGroupId);
      if (!laborGroup) return error(res, 404, "Labor group not found");
    }

    let cropEntries;
    if (req.body.cropEntries !== undefined) {
      try {
        cropEntries =
          typeof req.body.cropEntries === "string"
            ? JSON.parse(req.body.cropEntries)
            : req.body.cropEntries;
      } catch {
        return error(res, 400, "cropEntries must be valid JSON");
      }

      for (const entry of cropEntries) {
        if (!entry.allotmentVillageId)
          return error(
            res,
            400,
            "allotmentVillageId is required in every crop entry",
          );
        if (!entry.labourCount)
          return error(res, 400, "labourCount is required in every crop entry");

        const av = await AllotmentVillage.findByPk(entry.allotmentVillageId);
        if (!av)
          return error(
            res,
            404,
            `AllotmentVillage ${entry.allotmentVillageId} not found`,
          );
        if (av.supervisorId !== request.requestedBy) {
          return error(
            res,
            403,
            `Not the assigned supervisor for allotmentVillageId ${entry.allotmentVillageId}`,
          );
        }
      }

      await LabourRequestCropEntry.destroy({ where: { labourRequestId: id } });
      await LabourRequestCropEntry.bulkCreate(
        cropEntries.map((e) => ({
          labourRequestId: id,
          allotmentVillageId: e.allotmentVillageId,
          labourCount: e.labourCount,
          totalAcres: e.totalAcres,
          acresWorked: e.acresWorked,
          rowingTime: e.rowingTime,
        })),
      );
    }

    const startPhoto = req.files?.start_photo?.[0];
    const endPhoto = req.files?.end_photo?.[0];

    await request.update({
      ...(laborGroupId !== undefined && {
        laborGroupId,
        otherLaborGroupName: null,
      }),
      ...(otherLaborGroupName !== undefined &&
        !laborGroupId && { otherLaborGroupName, laborGroupId: null }),
      ...(fromLocation !== undefined && { fromLocation }),
      ...(toLocation !== undefined && { toLocation }),
      ...(transportType !== undefined && { transportType }),
      ...(notes !== undefined && { notes }),
      ...(startPhoto && {
        startPhotoUrl: `/uploads/labour-requests/${startPhoto.filename}`,
      }),
      ...(endPhoto && {
        endPhotoUrl: `/uploads/labour-requests/${endPhoto.filename}`,
      }),
    });

    const updated = await LabourRequest.findByPk(id, {
      include: [...HEADER_INCLUDES, ENTRY_INCLUDE],
    });

    return success(res, 200, "Labour request updated successfully", {
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/labour-requests/:id/verify — L2 action.
 * body: { laborGroupId? }
 *
 * If the original request used "Others" (otherLaborGroupName, no real
 * laborGroupId), L2 can resolve it to a real LaborGroup here, during
 * verification. This matters beyond just cleaning up the record — the
 * crop-wise payment calculation at approval time needs a real laborGroupId
 * to look up LaborGroupCropRate against; without resolving it here, the
 * request stays payment-less at approval (handled gracefully via
 * paymentSkippedReason, but resolving it here is how you avoid that).
 * Not resolving it is still allowed — L2 can verify first and this can be
 * left for later, or the request may never get a real group at all.
 */
async function verifyLabourRequest(req, res, next) {
  try {
    
    const { id } = req.params;
    const request = await LabourRequest.findByPk(id);
    if (!request) return error(res, 404, "Labour request not found");

    if (request.status !== "pending") {
      return error(
        res,
        409,
        `Cannot verify a request with status "${request.status}"`,
      );
    }

    const { laborGroupId } = req.body;
    const updates = {
      status: "verified",
      verifiedBy: req.employee.id,
      verifiedAt: new Date(),
    };

    if (laborGroupId !== undefined) {
      if (request.laborGroupId) {
        return error(
          res,
          409,
          "This request already has a real labor group assigned — nothing to resolve",
        );
      }

      const laborGroup = await LaborGroup.findByPk(laborGroupId);
      if (!laborGroup) return error(res, 404, "Labor group not found");

      updates.laborGroupId = laborGroupId;
      updates.otherLaborGroupName = null; // resolved — the free-text name is no longer needed
    }

    await request.update(updates);

    const updated = await LabourRequest.findByPk(id, {
      include: HEADER_INCLUDES,
    });

    return success(res, 200, "Labour request verified successfully", {
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/labour-requests/:id/approve — L1 action.
 * Computes the payment amount crop-wise: sum over every crop entry of
 * (labourCount * that crop's LaborGroupCropRate.pricePerPerson). If the
 * request used "Others" instead of a real LaborGroup, there's no rate to
 * look up, so no payment is auto-created — flagged in the response instead.
 */
async function approveLabourRequest(req, res, next) {
  try {
    
    const { id } = req.params;
    const request = await LabourRequest.findByPk(id, {
      include: [ENTRY_INCLUDE],
    });
    if (!request) return error(res, 404, "Labour request not found");

    if (request.status !== "verified") {
      return error(
        res,
        409,
        `Cannot approve a request with status "${request.status}"`,
      );
    }

    await request.update({
      status: "approved",
      approvedBy: req.employee.id,
      approvedAt: new Date(),
    });

    let payment = null;
    let paymentSkippedReason = null;

    if (request.laborGroupId) {
      let amount = 0;
      for (const entry of request.cropEntries) {
        const cropId = entry.allotmentVillage.allotment.companyCrop.cropId;
        const rateRow = await LaborGroupCropRate.findOne({
          where: { laborGroupId: request.laborGroupId, cropId },
        });
        if (rateRow) {
          amount += Number(entry.labourCount) * Number(rateRow.pricePerPerson);
        }
      }

      if (amount > 0) {
        payment = await createPaymentIfNeeded({
          type: "labour",
          sourceRequestType: "labour_request",
          sourceRequestId: request.id,
          recipientType: "labor_group",
          recipientId: request.laborGroupId,
          amount,
          requestedBy: request.requestedBy,
          verifiedBy: request.verifiedBy,
          approvedBy: req.employee.id,
        });
      } else {
        paymentSkippedReason =
          "No crop-wise rate found for this labor group on the requested crop(s)";
      }
    } else {
      paymentSkippedReason =
        "This request used an 'Others' labor group — no rate table to calculate a payment from";
    }

    const updated = await LabourRequest.findByPk(id, {
      include: [...HEADER_INCLUDES, ENTRY_INCLUDE],
    });

    return success(res, 200, "Labour request approved successfully", {
      data: updated,
      payment,
      paymentSkippedReason,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/labour-requests/:id/reject — L2 (verification stage) or L1 (approval stage) */
async function rejectLabourRequest(req, res, next) {
  try {
    
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const request = await LabourRequest.findByPk(id);
    if (!request) return error(res, 404, "Labour request not found");

    if (["approved", "rejected"].includes(request.status)) {
      return error(
        res,
        409,
        `Cannot reject a request with status "${request.status}"`,
      );
    }

    // The stage is derived from where the request currently sits — still
    // "pending" means this is happening during L2's verification; already
    // "verified" means it's happening during L1's approval.
    const rejectedStage =
      request.status === "pending" ? "verification" : "approval";

    await request.update({
      status: "rejected",
      rejectionReason,
      rejectedBy: req.employee.id,
      rejectedStage,
    });

    return success(res, 200, "Labour request rejected", { data: request });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyLabourRequests,
  getAllLabourRequests,
  getLabourRequestById,
  createLabourRequest,
  updateLabourRequest,
  verifyLabourRequest,
  approveLabourRequest,
  rejectLabourRequest,
};

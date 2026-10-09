"use strict";
const { Op } = require("sequelize");
const {
  sequelize,
  LogisticsPartner,
  Vehicle,
  VehicleRequest,
  Payment,
  State,
  Employee,
  LoadingRequest,
  LoadingRequestEntry,
  Village,
  Warehouse,
} = require("../models");
const {
  startOfCurrentMonth,
  resolveSeason,
  seasonFilter,
  paymentSeasonWhere,
  toDateOnly,
} = require("../utils/periods");
const { calculateLoadingAmounts } = require("../utils/loadingAmounts");
const { allotmentVillageInclude } = require("../utils/bagsCommon");
const {
  getPagination,
  hasPagination,
  statusFilter,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/**
 * GET /api/logistics?search=sri&page=1&limit=20
 * With page/limit: full paginated list. Without: every partner as
 * { id, logisticsId, name } for dropdowns.
 */
const getAllLogisticsPartners = async (req, res, next) => {
  try {
    const { search, status } = req.query;

    const where = statusFilter(status); // ?status=Active|Inactive
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { logisticsId: { [Op.like]: term } },
      ];
    }

    if (!hasPagination(req.query)) {
      const data = await LogisticsPartner.findAll({
        where,
        attributes: ["id", "logisticsId", "name"],
        order: [["createdAt", "DESC"]],
      });
      return success(res, 200, "Logistics partners fetched successfully", {
        data,
      });
    }

    const { page, limit, offset } = getPagination(req.query);
    const result = await LogisticsPartner.findAndCountAll({
      where,
      include: [{ model: State, as: "state", attributes: ["id", "name"] }],
      attributes: {
        include: [
          [
            // Counted per partner in the same query — always matches its current vehicles.
            sequelize.literal(
              "(SELECT COUNT(*) FROM `Vehicles` AS v WHERE v.logisticsPartnerId = `LogisticsPartner`.id)",
            ),
            "vehicleCount",
          ],
        ],
      },
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return success(
      res,
      200,
      "Logistics partners fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/logistics/:id — includes its vehicles */
const getLogisticsPartnerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const partner = await LogisticsPartner.findByPk(id, {
      include: [{ model: Vehicle, as: "vehicles" }],
    });
    if (!partner) return error(res, 404, "Logistics partner not found");

    // Details cards: trips this month + this partner's unpaid transport bills.
    const pendingBillsWhere = {
      type: "transport",
      status: "pending",
      recipientType: "logistics_partner",
      recipientId: partner.id,
    };
    const [tripsThisMonth, pendingBills, pendingBillsAmount] = await Promise.all([
      VehicleRequest.count({
        where: {
          logisticsPartnerId: partner.id,
          status: "assigned",
          createdAt: { [Op.gte]: startOfCurrentMonth() },
        },
      }),
      Payment.count({ where: pendingBillsWhere }),
      Payment.sum("amount", { where: pendingBillsWhere }),
    ]);

    return success(res, 200, "Logistics partner fetched successfully", {
      data: {
        ...partner.toJSON(),
        tripsThisMonth,
        pendingBills,
        pendingBillsAmount: Number(pendingBillsAmount) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/logistics */
const createLogisticsPartner = async (req, res, next) => {
  try {
    const {
      name,
      ownerName,
      ownerNumber,
      rate,
      fullAddress,
      location,
      pincode,
      stateId,
      status,
    } = req.body;

    if (!name) return error(res, 400, "name is required");
    if (!ownerName) return error(res, 400, "ownerName is required");

    const partner = await LogisticsPartner.create({
      name,
      ownerName,
      ownerNumber,
      rate,
      fullAddress,
      location,
      pincode,
      stateId,
      status: status || "Active",
    });
    const logisticsId = await generateId("LG", partner?.id);
    await partner?.update({ logisticsId });

    return success(res, 201, "Logistics partner created successfully", {
      data: partner,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/logistics/:id */
const updateLogisticsPartner = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const partner = await LogisticsPartner.findByPk(id);
    if (!partner) return error(res, 404, "Logistics partner not found");

    const {
      name,
      ownerName,
      ownerNumber,
      rate,
      fullAddress,
      location,
      pincode,
      stateId,
      status,
    } = req.body;

    await partner.update({
      ...(name !== undefined && { name }),
      ...(ownerName !== undefined && { ownerName }),
      ...(ownerNumber !== undefined && { ownerNumber }),
      ...(rate !== undefined && { rate }),
      ...(fullAddress !== undefined && { fullAddress }),
      ...(location !== undefined && { location }),
      ...(pincode !== undefined && { pincode }),
      ...(stateId !== undefined && { stateId }),
      ...(status !== undefined && { status }),
    });

    return success(res, 200, "Logistics partner updated successfully", {
      data: partner,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/logistics/:logisticsPartnerId/vehicles?page=&limit=
 * With page/limit: full paginated list. Without: every vehicle as
 * { id, vehicleId, regNo } for dropdowns (a vehicle has no name — regNo is its label).
 */
const getVehiclesByLogisticsPartnerId = async (req, res, next) => {
  try {
    const { logisticsPartnerId } = req.params;
    if (!logisticsPartnerId)
      return error(res, 400, "logisticsPartnerId is required");

    const partner = await LogisticsPartner.findByPk(logisticsPartnerId);
    if (!partner) return error(res, 404, "Logistics partner not found");

    if (!hasPagination(req.query)) {
      const data = await Vehicle.findAll({
        where: { logisticsPartnerId },
        attributes: ["id", "vehicleId", "regNo"],
        order: [["createdAt", "DESC"]],
      });
      return success(res, 200, "Vehicles fetched successfully", { data });
    }

    const { page, limit, offset } = getPagination(req.query);
    const result = await Vehicle.findAndCountAll({
      where: { logisticsPartnerId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Vehicles fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** POST /api/logistics/:logisticsPartnerId/vehicles */
const createVehicle = async (req, res, next) => {
  try {
    const { logisticsPartnerId } = req.params;
    if (!logisticsPartnerId)
      return error(res, 400, "logisticsPartnerId is required");

    const partner = await LogisticsPartner.findByPk(logisticsPartnerId);
    if (!partner) return error(res, 404, "Logistics partner not found");

    const { type, regNo, capacity, driverName, driverNumber } = req.body;
    // if (!type) return error(res, 400, "type is required");
    // if (!regNo) return error(res, 400, "regNo is required");

    const vehicle = await Vehicle.create({
      logisticsPartnerId,
      type,
      regNo,
      capacity,
      driverName,
      driverNumber,
    });
    const vehicleId = generateId("VEH", vehicle?.id);
    await vehicle.update({ vehicleId });

    return success(res, 201, "Vehicle created successfully", { data: vehicle });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/vehicles/:id */
const updateVehicle = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    if (!vehicleId) return error(res, 400, "vehicleId is required");

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return error(res, 404, "Vehicle not found");

    const { type, regNo, capacity, driverName, driverNumber } = req.body;

    await vehicle.update({
      ...(type !== undefined && { type }),
      ...(regNo !== undefined && { regNo }),
      ...(capacity !== undefined && { capacity }),
      ...(driverName !== undefined && { driverName }),
      ...(driverNumber !== undefined && { driverNumber }),
    });

    return success(res, 200, "Vehicle updated successfully", { data: vehicle });
  } catch (err) {
    next(err);
  }
};

const getVehicleById = async (req, res, next) => {
  const { vehicleId } = req.params;
  if (!vehicleId) {
    return res.status(400).json({
      success: false,
      message: "vehicleId is required",
    });
  }
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: "Vehicle not found",
    });
  }
  return res.status(200).json({
    success: true,
    message: "Vehicle fetched successfully",
    data: vehicle,
  });
};

const updateLogisticsPartnerStatus = async (req, res, next) => {
  try {
    const { logisticsId } = req.params;
    const { status } = req.body;
    if (!logisticsId) return error(res, 400, "logisticsId is required");

    if (!status) return error(res, 400, "status is required");

    if (!["Active", "Inactive"].includes(status))
      return error(res, 400, "Invalid status");

    const logisticPartner = await LogisticsPartner.findByPk(logisticsId);
    if (!logisticPartner) {
      return error(res, 404, "LogisticsPartner not found");
    }
    await logisticPartner.update({ status });
    return success(res, 200, "LogisticsPartner status updated successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * GET /logistics/summary?season=Kharif|Rabi&year=25-26 — Logistics page KPI cards.
 * totalPartners  = every logistics partner
 * tripsThisMonth = vehicle requests assigned a vehicle, raised this month
 * trips          = vehicle requests assigned a vehicle, raised in the season
 * dueAmount      = transport payments still pending (raised in the season)
 * paidAmount     = transport payments processed (paid in the season)
 * Without season / year, trips and amounts cover all time (see seasonFilter).
 */
const getLogisticsSummary = async (req, res, next) => {
  try {
    const season = seasonFilter(req.query);
    const transport = { type: "transport", ...paymentSeasonWhere(season) };
    const assigned = { status: "assigned" };
    const [totalPartners, tripsThisMonth, trips, dueAmount, paidAmount] = await Promise.all([
      LogisticsPartner.count(),
      VehicleRequest.count({ where: { ...assigned, createdAt: { [Op.gte]: startOfCurrentMonth() } } }),
      VehicleRequest.count({
        where: { ...assigned, ...(season && { createdAt: { [Op.gte]: season.start, [Op.lt]: season.end } }) },
      }),
      Payment.sum("amount", { where: { ...transport, status: "pending" } }),
      Payment.sum("amount", { where: { ...transport, status: "processed" } }),
    ]);

    return success(res, 200, "Logistics summary fetched successfully", {
      data: {
        totalPartners,
        tripsThisMonth,
        trips,
        dueAmount: Number(dueAmount) || 0,
        paidAmount: Number(paidAmount) || 0,
        season: season ? season.label : "All time",
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* Payments — Transport payments made to a logistics partner           */
/* ------------------------------------------------------------------ */
// Transport payments are created from loading requests (L1 "Create Transport
// Payment") with recipientType "logistics_partner" + recipientId = partner.

const PERSON_ATTRS = ["id", "empId", "name", "level"];
const PAYMENT_PEOPLE = [
  { model: Employee, as: "creator", attributes: PERSON_ATTRS },
  { model: Employee, as: "processor", attributes: PERSON_ATTRS },
];

const partnerPaymentWhere = (partnerId) => ({
  type: "transport",
  recipientType: "logistics_partner",
  recipientId: partnerId,
});

const sumAmount = async (where) => Number(await Payment.sum("amount", { where })) || 0;

/**
 * One partner's transport payment totals:
 *   pendingBills / pendingAmount — payments still pending
 *   paidThisSeason               — processed with a payment date inside `season`
 *   paidTotal                    — processed, all time
 */
async function getPartnerPaymentTotals(partnerId, season) {
  const where = partnerPaymentWhere(partnerId);
  const [pendingBills, pendingAmount, paidThisSeason, paidTotal] = await Promise.all([
    Payment.count({ where: { ...where, status: "pending" } }),
    sumAmount({ ...where, status: "pending" }),
    sumAmount({
      ...where,
      status: "processed",
      paymentDate: { [Op.gte]: toDateOnly(season.start), [Op.lt]: toDateOnly(season.end) },
    }),
    sumAmount({ ...where, status: "processed" }),
  ]);
  return { pendingBills, pendingAmount, paidThisSeason, paidTotal, season: season.label };
}

/**
 * GET /logistics/:id/payments?page=&limit=&status=pending|processed&season=&year=
 * Transport payments history for one logistics partner, plus `totals`
 * (see getPartnerPaymentTotals). Each row: paymentCode, sourceCode (LD-…),
 * route (from village -> to warehouse), requestedBy (supervisor on the loading
 * request), approvedBy (who created the payment), processedBy, amount, date,
 * mode, status.
 */
const getLogisticsPartnerPayments = async (req, res, next) => {
  try {
    const partner = await LogisticsPartner.findByPk(req.params.id, { attributes: ["id"] });
    if (!partner) return error(res, 404, "Logistics partner not found");

    const where = { ...partnerPaymentWhere(partner.id), ...paymentSeasonWhere(seasonFilter(req.query)) };
    if (["pending", "processed"].includes(req.query.status)) where.status = req.query.status;

    const { page, limit, offset } = getPagination(req.query);
    const [result, totals] = await Promise.all([
      Payment.findAndCountAll({
        where,
        include: PAYMENT_PEOPLE,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      getPartnerPaymentTotals(partner.id, resolveSeason(req.query)),
    ]);

    // The loading request each payment came from (code, route, requester).
    const requestIds = result.rows
      .filter((p) => p.sourceRequestType === "loading_request")
      .map((p) => p.sourceRequestId);
    const requests = requestIds.length
      ? await LoadingRequest.findAll({
          where: { id: requestIds },
          attributes: ["id", "requestCode"],
          include: [
            { model: Employee, as: "requester", attributes: PERSON_ATTRS },
            { model: Village, as: "fromVillage", attributes: ["id", "name"] },
            { model: Warehouse, as: "toWarehouse", attributes: ["id", "warehouseId", "locationName"] },
          ],
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
        fromVillage: request?.fromVillage || null,
        toWarehouse: request?.toWarehouse || null,
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

    return success(res, 200, "Logistics partner payments fetched successfully", response);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /logistics/:id/payments/:paymentId — the payment drawer: how one
 * transport bill adds up, from the loading request it was created for.
 *   transportAmount = rate × totalDkQuantity + marketsAmount + kanttaBill
 *   totalAmount     = the Payment amount (what is actually paid)
 */
const getLogisticsPartnerPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      where: { id: req.params.paymentId, ...partnerPaymentWhere(req.params.id) },
      include: PAYMENT_PEOPLE,
    });
    if (!payment) return error(res, 404, "Payment not found for this logistics partner");

    const request =
      payment.sourceRequestType === "loading_request"
        ? await LoadingRequest.findByPk(payment.sourceRequestId, {
            include: [
              { model: Employee, as: "requester", attributes: PERSON_ATTRS },
              { model: Village, as: "fromVillage", attributes: ["id", "name"] },
              { model: Warehouse, as: "toWarehouse", attributes: ["id", "warehouseId", "locationName"] },
              {
                model: LoadingRequestEntry,
                as: "cropEntries",
                separate: true,
                include: allotmentVillageInclude("allotmentVillage"),
              },
            ],
          })
        : null;
    const amounts = request ? calculateLoadingAmounts(request, request.cropEntries || []) : null;

    return success(res, 200, "Logistics partner payment fetched successfully", {
      data: {
        id: payment.id,
        paymentCode: payment.paymentCode,
        status: payment.status,
        sourceCode: request?.requestCode || null,
        fromVillage: request?.fromVillage || null,
        toWarehouse: request?.toWarehouse || null,
        transporterName: request?.transporterName || null,
        noOfBags: amounts?.totalBags ?? null,
        dkQuantity: amounts?.totalDkQuantity ?? null,
        rate: amounts?.rate ?? null,
        marketsAmount: amounts?.marketsAmount ?? null,
        kanttaBill: amounts?.kanttaBill ?? null,
        transportAmount: amounts?.transportAmount ?? null,
        loadings: (request?.cropEntries || []).map((e) => ({
          allotmentId: e.allotmentVillage?.allotment?.allotmentId || null,
          village: e.allotmentVillage?.village?.name || null,
          crop: e.allotmentVillage?.allotment?.companyCrop?.crop?.name || null,
          variety: e.allotmentVillage?.allotment?.companyCrop?.varietyName || null,
          noOfBags: e.noOfBags,
          dkQuantity: Number(e.dkQuantity),
        })),
        totalAmount: Number(payment.amount),
        referenceNo: payment.referenceId,
        paymentMode: payment.paymentMode,
        paymentDate: payment.paymentDate,
        remark: payment.remark,
        requestedDate: request?.createdAt || null,
        requestedBy: request?.requester || null,
        approvedBy: payment.creator,
        processedBy: payment.processor,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLogisticsPartnerPayments,
  getLogisticsPartnerPaymentById,
  getLogisticsSummary,
  getAllLogisticsPartners,
  getLogisticsPartnerById,
  createLogisticsPartner,
  updateLogisticsPartner,
  getVehiclesByLogisticsPartnerId,
  createVehicle,
  updateVehicle,
  getVehicleById,
  updateLogisticsPartnerStatus,
};

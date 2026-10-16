"use strict";
const { Op, where } = require("sequelize");
const {
  Allotment,
  AllotmentVillage,
  SeedCompany,
  CompanyCrop,
  Crop,
  Village,
  SubOrganizer,
  Employee,
  State,
} = require("../models");
const {
  getPagination,
  hasPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");
const {
  OPEN_ALLOTMENT,
  normalizeAllotmentStatus,
} = require("../utils/allotmentStatus");
const { toCropYear } = require("../utils/periods");
const { allotmentMessages } = require("../constants/message/allotmentMessages");

const ALLOTMENT_INCLUDES = [
  {
    model: SeedCompany,
    as: "company",
    attributes: ["id", "name", "district"],
    include: [
      {
        model: State,
        as: "state",
        attributes: ["id", "name"],
      },
    ],
  },
  {
    model: CompanyCrop,
    as: "companyCrop",
    include: { model: Crop, as: "crop", attributes: ["id", "name"] },
  },
];

/** Sums an Allotment's village rows into allottedAcres/standingAcres/gpsPendingAcres/balanceAcres. */
const withVillageTotals = (allotment) => {
  const villageRows = allotment.villageAllotments || [];
  const allottedAcres = villageRows.reduce(
    (s, v) => s + Number(v.allottedAcres || 0),
    0,
  );
  const standingAcres = villageRows.reduce(
    (s, v) => s + Number(v.standingAcres || 0),
    0,
  );
  const gpsPendingAcres = villageRows.reduce(
    (s, v) => s + Number(v.gpsPendingAcres || 0),
    0,
  );
  const balanceAcres = Number(allotment.reqAcres || 0) - allottedAcres;

  return {
    ...allotment.toJSON(),
    allottedAcres,
    standingAcres,
    gpsPendingAcres,
    balanceAcres,
  };
};

/**
 * List-page cards: Acres allotted / Standing acres / Balance acres / GPS
 * pending acres, aggregated across every Allotment matching the current
 * filters (not just the current page).
 */
const getAllotmentSummary = async (where, cropId) => {
  const allotments = await Allotment.findAll({
    where,
    attributes: ["id", "reqAcres"],
    include: cropId
      ? [
          {
            model: CompanyCrop,
            as: "companyCrop",
            where: { cropId },
            attributes: [],
            required: true,
          },
        ]
      : [],
  });

  const allotmentIds = allotments.map((a) => a.id);
  const totalReqAcres = allotments.reduce(
    (s, a) => s + Number(a.reqAcres || 0),
    0,
  );

  if (!allotmentIds.length) {
    return {
      acresAllotted: 0,
      standingAcres: 0,
      balanceAcres: totalReqAcres,
      gpsPendingAcres: 0,
    };
  }

  const [acresAllotted, standingAcres, gpsPendingAcres] = await Promise.all([
    AllotmentVillage.sum("allottedAcres", {
      where: { allotmentId: allotmentIds },
    }),
    AllotmentVillage.sum("standingAcres", {
      where: { allotmentId: allotmentIds },
    }),
    AllotmentVillage.sum("gpsPendingAcres", {
      where: { allotmentId: allotmentIds },
    }),
  ]);

  return {
    acresAllotted: acresAllotted || 0,
    standingAcres: standingAcres || 0,
    balanceAcres: totalReqAcres - (acresAllotted || 0),
    gpsPendingAcres: gpsPendingAcres || 0,
  };
};

/** Controller function for tp get all the procurements
 */
const getAllAllotments = async (req, res, next) => {
  try {
    const {
      search,
      company: companyId,
      crop: cropId,
      season,
      year,
    } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (companyId) where.companyId = companyId;
    if (season) where.season = season;
    if (year) where.year = toCropYear(year) || year; // "25-26" (2025 also accepted)
    if (search) where.allotmentId = { [Op.like]: `%${search}%` };

    const [result, summary] = await Promise.all([
      Allotment.findAndCountAll({
        where,
        include: [
          ...ALLOTMENT_INCLUDES.map((inc) =>
            inc.as === "companyCrop" && cropId
              ? { ...inc, where: { cropId }, required: true }
              : inc,
          ),
          {
            model: AllotmentVillage,
            as: "villageAllotments",
            attributes: [
              "id",
              "allottedAcres",
              "standingAcres",
              "gpsPendingAcres",
            ],
            separate: true,
          },
        ],
        distinct: true,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      getAllotmentSummary(where, cropId),
    ]);

    const rows = result.rows.map(withVillageTotals);

    return success(res, 200, allotmentMessages.allotmentsFetchedSuccessfully, {
      ...buildPaginatedResponse({ rows, count: result.count }, page, limit),
      summary,
    });
  } catch (err) {
    next(err);
  }
};

/** Controller function to get the all the village allotments from all procurements
 */
const getAllotmentVillageTable = async (req, res, next) => {
  try {
    const {
      villageId,
      company: companyId,
      season,
      year,
      supervisor: supervisorId,
      search,
    } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (villageId) where.villageId = villageId;
    if (supervisorId) where.supervisorId = supervisorId;
    if (search) where.allotmentVillageId = { [Op.like]: `%${search}%` };

    const allotmentWhere = {};
    if (companyId) allotmentWhere.companyId = companyId;
    if (season) allotmentWhere.season = season;
    if (year) allotmentWhere.year = toCropYear(year) || year;
    const hasAllotmentFilter = Object.keys(allotmentWhere).length > 0;

    const result = await AllotmentVillage.findAndCountAll({
      where,
      include: [
        {
          model: Allotment,
          as: "allotment",
          where: hasAllotmentFilter ? allotmentWhere : undefined,
          required: hasAllotmentFilter,
          include: ALLOTMENT_INCLUDES,
        },
        {
          model: Village,
          as: "village",
          attributes: ["id", "villageId", "name"],
        },
        { model: SubOrganizer, as: "subOrganizer", attributes: ["id", "name"] },
        {
          model: Employee,
          as: "supervisor",
          attributes: ["id", "empId", "name", "level"],
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
      allotmentMessages.allottedVillagesFetchedSuccessfully,
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/allotments/:id */
const getAllotmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, allotmentMessages.idIsRequired);

    const allotment = await Allotment.findByPk(id, {
      include: [...ALLOTMENT_INCLUDES],
    });

    if (!allotment) return error(res, 404, allotmentMessages.allotmentNotFound);

    return success(res, 200, allotmentMessages.allotmentFetchedSuccessfully, {
      data: withVillageTotals(allotment),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /allotments/:id/villages?page=&limit=&search=&status=open|closed&supervisorId=&villageId=
 * Village allotments of one allotment (the allotment's numeric id), with:
 *   allotment — header: code, company, crop, variety, season, year, status, reqAcres
 *   totals    — over ALL its village rows (filters don't change them):
 *               allottedAcres, standingAcres, gpsPendingAcres, balanceAcres, villages
 *   data      — the village rows (filtered + paginated)
 * Without page/limit, every matching row is returned (no pagination block).
 */
const getVillageAllotmentsByAllotment = async (req, res, next) => {
  try {
    const allotment = await Allotment.findByPk(req.params.id, {
      attributes: [
        "id",
        "allotmentId",
        "season",
        "year",
        "status",
        "reqAcres",
        "reqQtyKgs",
      ],
      include: [
        {
          model: SeedCompany,
          as: "company",
          attributes: ["id", "companyId", "name"],
        },
        {
          model: CompanyCrop,
          as: "companyCrop",
          attributes: ["id", "companyCropId", "varietyName"],
          include: {
            model: Crop,
            as: "crop",
            attributes: ["id", "cropId", "name"],
          },
        },
      ],
    });
    if (!allotment) return error(res, 404, allotmentMessages.allotmentNotFound);

    const { search, supervisorId, villageId } = req.query;
    let status;
    if (req.query.status !== undefined) {
      status = normalizeAllotmentStatus(req.query.status);
      if (!status) return error(res, 400, allotmentMessages.statusMustBeOpenOrClosed);
    }

    const where = { allotmentId: allotment.id };
    if (status) where.status = status;
    if (supervisorId) where.supervisorId = supervisorId;
    if (villageId) where.villageId = villageId;
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { allotmentVillageId: { [Op.like]: term } },
        { "$village.name$": { [Op.like]: term } },
        { "$subOrganizer.name$": { [Op.like]: term } },
        { "$supervisor.name$": { [Op.like]: term } },
        { "$supervisor.empId$": { [Op.like]: term } },
      ];
    }

    const query = {
      where,
      attributes: [
        "id",
        "allotmentVillageId",
        "allottedAcres",
        "standingAcres",
        "gpsPendingAcres",
        "status",
        "createdAt",
        "villageId",
        "subOrganizerId",
      ],
      include: [
        {
          model: Village,
          as: "village",
          attributes: ["id", "villageId", "name"],
        },
        {
          model: SubOrganizer,
          as: "subOrganizer",
          attributes: ["id", "subOrganizerId", "name"],
        },
        {
          model: Employee,
          as: "supervisor",
          attributes: ["id", "empId", "name", "level"],
        },
      ],
      order: [["createdAt", "DESC"]],
    };

    // Totals over every village row of the allotment, whatever the filters.
    const sumOf = (field) =>
      AllotmentVillage.sum(field, { where: { allotmentId: allotment.id } });
    const [allotted, standing, gpsPending, villages] = await Promise.all([
      sumOf("allottedAcres"),
      sumOf("standingAcres"),
      sumOf("gpsPendingAcres"),
      AllotmentVillage.count({ where: { allotmentId: allotment.id } }),
    ]);
    const allottedAcres = Number(allotted) || 0;
    const totals = {
      villages,
      allottedAcres,
      standingAcres: Number(standing) || 0,
      gpsPendingAcres: Number(gpsPending) || 0,
      balanceAcres: (Number(allotment.reqAcres) || 0) - allottedAcres,
    };

    if (!hasPagination(req.query)) {
      const data = await AllotmentVillage.findAll(query);
      return success(res, 200, allotmentMessages.villageAllotmentsFetchedSuccessfully, {
        allotment,
        totals,
        data,
      });
    }

    const { page, limit, offset } = getPagination(req.query);
    const result = await AllotmentVillage.findAndCountAll({
      ...query,
      limit,
      offset,
      distinct: true,
    });
    return success(res, 200, allotmentMessages.villageAllotmentsFetchedSuccessfully, {
      allotment,
      totals,
      ...buildPaginatedResponse(result, page, limit),
    });
  } catch (err) {
    next(err);
  }
};

/** Controller function to create the Allotment
 */
const createAllotment = async (req, res, next) => {
  try {
    const { companyId, companyCropId, reqAcres, reqQtyKgs, season, year } =
      req.body;

    if (!companyId) return error(res, 400, allotmentMessages.companyIdIsRequired);
    if (!companyCropId) return error(res, 400, allotmentMessages.companyCropIdIsRequired);
    if (!reqAcres) return error(res, 400, allotmentMessages.reqAcresIsRequired);
    if (!season) return error(res, 400, allotmentMessages.seasonIsRequired);
    if (!["Kharif", "Rabi"].includes(season))
      return error(res, 400, allotmentMessages.seasonMustBeKharifOrRabi);
    if (!year) return error(res, 400, allotmentMessages.yearIsRequired);
    const cropYear = toCropYear(year); // "25-26"
    if (!cropYear)
      return error(res, 400, allotmentMessages.yearMustBeACropYear);

    const company = await SeedCompany.findByPk(companyId);
    if (!company) return error(res, 404, allotmentMessages.seedCompanyNotFound);

    const companyCrop = await CompanyCrop.findByPk(companyCropId);
    if (!companyCrop) return error(res, 404, allotmentMessages.cropVarietyNotFound);
    if (companyCrop.companyId !== Number(companyId)) {
      return error(
        res,
        400,
        allotmentMessages.thisCropVarietyDoesNotBelong,
      );
    }

    const allotment = await Allotment.create({
      companyId,
      companyCropId,
      reqAcres,
      reqQtyKgs,
      season,
      year: cropYear,
      status: "open",
    });
    const allotmentId = generateId("AL", allotment?.id);
    await allotment.update({ allotmentId });

    const created = await Allotment.findByPk(allotment.id, {
      include: ALLOTMENT_INCLUDES,
    });

    return success(res, 201, allotmentMessages.allotmentCreatedSuccessfully, {
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

/** Controller function to update the procurement
 */
const updateAllotment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, allotmentMessages.idIsRequired);

    const allotment = await Allotment.findByPk(id, {
      include: [
        {
          model: AllotmentVillage,
          as: "villageAllotments",
          attributes: ["allottedAcres"],
          separate: true,
        },
      ],
    });
    if (!allotment) return error(res, 404, allotmentMessages.allotmentNotFound);

    const { reqAcres, reqQtyKgs, season, year, status } = req.body;

    if (season !== undefined && !["Kharif", "Rabi"].includes(season)) {
      return error(res, 400, allotmentMessages.seasonMustBeKharifOrRabi);
    }
    if (status !== undefined && !["open", "closed"].includes(status)) {
      return error(res, 400, allotmentMessages.statusMustBeOpenOrClosed);
    }
    const cropYear = year !== undefined ? toCropYear(year) : undefined; // "25-26"
    if (year !== undefined && !cropYear) {
      return error(res, 400, allotmentMessages.yearMustBeACropYear);
    }

    if (reqAcres !== undefined) {
      const currentAllotted = (allotment.villageAllotments || []).reduce(
        (s, v) => s + Number(v.allottedAcres || 0),
        0,
      );
      if (Number(reqAcres) < currentAllotted) {
        return error(
          res,
          409,
          allotmentMessages.cannotReduceRequiredAcresBelowThe(currentAllotted),
        );
      }
    }

    await allotment.update({
      ...(reqAcres !== undefined && { reqAcres }),
      ...(reqQtyKgs !== undefined && { reqQtyKgs }),
      ...(season !== undefined && { season }),
      ...(cropYear !== undefined && { year: cropYear }),
      ...(status !== undefined && { status }),
    });

    return success(res, 200, allotmentMessages.allotmentUpdatedSuccessfully, {
      data: allotment,
    });
  } catch (err) {
    next(err);
  }
};

/** Controller function to delete Allotment
 */
const deleteAllotment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, allotmentMessages.idIsRequired);

    const allotment = await Allotment.findByPk(id);
    if (!allotment) return error(res, 404, allotmentMessages.allotmentNotFound);

    const villageCount = await AllotmentVillage.count({
      where: { allotmentId: id },
    });
    if (villageCount > 0) {
      return error(
        res,
        409,
        allotmentMessages.cannotDeleteAnAllotmentThatHas,
      );
    }

    await allotment.destroy();

    return success(res, 200, allotmentMessages.allotmentDeletedSuccessfully, {
      data: { id: Number(id) },
    });
  } catch (err) {
    next(err);
  }
};

/**Controller function for to create the villageAllotment
 */
const addVillageAllotment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, allotmentMessages.idIsRequired);

    const allotment = await Allotment.findByPk(id, {
      include: [
        {
          model: AllotmentVillage,
          as: "villageAllotments",
          attributes: ["allottedAcres"],
          separate: true,
        },
      ],
    });
    if (!allotment) return error(res, 404, allotmentMessages.allotmentNotFound);

    const { villageId, subOrganizerId, allottedAcres, supervisorId } = req.body;

    if (!villageId) return error(res, 400, allotmentMessages.villageIdIsRequired);
    if (allottedAcres === undefined)
      return error(res, 400, allotmentMessages.allottedAcresIsRequired);

    const village = await Village.findByPk(villageId);
    if (!village) return error(res, 404, allotmentMessages.villageNotFound);

    if (subOrganizerId !== undefined) {
      const subOrganizer = await SubOrganizer.findByPk(subOrganizerId);
      if (!subOrganizer) return error(res, 404, allotmentMessages.subOrganizerNotFound);
    }

    if (supervisorId !== undefined) {
      const supervisor = await Employee.findByPk(supervisorId);
      if (!supervisor) return error(res, 404, allotmentMessages.supervisorEmployeeNotFound);
    }

    const currentAllotted = (allotment.villageAllotments || []).reduce(
      (s, v) => s + Number(v.allottedAcres || 0),
      0,
    );
    const newTotal = currentAllotted + Number(allottedAcres);
    if (newTotal > Number(allotment.reqAcres)) {
      return error(
        res,
        409,
        allotmentMessages.allottingAcresWouldExceedTheRequested(allottedAcres, allotment.reqAcres, currentAllotted),
      );
    }

    const villageAllotment = await AllotmentVillage.create({
      allotmentId: id,
      villageId,
      subOrganizerId,
      supervisorId,
      allottedAcres,
      standingAcres: 0,
      gpsPendingAcres: allottedAcres,
    });
    const allotmentVillageId = generateId("AT", villageAllotment?.id);
    await villageAllotment.update({ allotmentVillageId });

    const created = await AllotmentVillage.findByPk(villageAllotment.id, {
      include: [
        { model: Village, as: "village" },
        { model: SubOrganizer, as: "subOrganizer" },
        {
          model: Employee,
          as: "supervisor",
          attributes: ["id", "empId", "name", "level"],
        },
      ],
    });

    return success(res, 201, allotmentMessages.villageAllottedSuccessfully, {
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

/** Controller function update the villageAllotment
 */
async function updateVillageAllotment(req, res, next) {
  try {
    const { id, villageAllotmentId } = req.params;
    if (!id) return error(res, 400, allotmentMessages.idIsRequired);
    if (!villageAllotmentId)
      return error(res, 400, allotmentMessages.villageAllotmentIdIsRequired);

    const villageAllotment = await AllotmentVillage.findOne({
      where: { id: villageAllotmentId, allotmentId: id },
    });
    if (!villageAllotment)
      return error(res, 404, allotmentMessages.villageAllotmentNotFound);

    const {
      allottedAcres,
      standingAcres,
      gpsPendingAcres,
      supervisorId,
      subOrganizerId,
      villageId,
    } = req.body;

    // "opened" / "open" / "closed". Closed = hidden from the supervisor
    // everywhere (dropdowns, lists, new requests) — see utils/allotmentStatus.
    let status;
    if (req.body.status !== undefined) {
      status = normalizeAllotmentStatus(req.body.status);
      if (!status) return error(res, 400, allotmentMessages.statusMustBeOpenedOrClosed);
    }

    if (supervisorId !== undefined) {
      const supervisor = await Employee.findByPk(supervisorId);
      if (!supervisor) return error(res, 404, allotmentMessages.supervisorEmployeeNotFound);
    }

    if (allottedAcres !== undefined) {
      const allotment = await Allotment.findByPk(id, {
        include: [
          {
            model: AllotmentVillage,
            as: "villageAllotments",
            attributes: ["id", "allottedAcres"],
            separate: true,
          },
        ],
      });

      const othersTotal = (allotment.villageAllotments || [])
        .filter((v) => v.id !== Number(villageAllotmentId))
        .reduce((s, v) => s + Number(v.allottedAcres || 0), 0);

      const newTotal = othersTotal + Number(allottedAcres);
      if (newTotal > Number(allotment.reqAcres)) {
        return error(
          res,
          409,
          allotmentMessages.allottingAcresWouldExceedTheRequested2(allottedAcres, allotment.reqAcres, othersTotal),
        );
      }
    }

    await villageAllotment.update({
      ...(villageId !== undefined && { villageId }),
      ...(allottedAcres !== undefined && { allottedAcres }),
      ...(standingAcres !== undefined && { standingAcres }),
      ...(gpsPendingAcres !== undefined && { gpsPendingAcres }),
      ...(supervisorId !== undefined && { supervisorId }),
      ...(subOrganizerId !== undefined && { subOrganizerId }),
      ...(status !== undefined && { status }),
    });

    return success(res, 200, allotmentMessages.villageAllotmentUpdatedSuccessfully, {
      data: villageAllotment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /allotment-villages/:villageAllotmentId/standing-acres   body: { standingAcres }
 * Saving standing acres also sets this village's allottedAcres = standingAcres
 * and gpsPendingAcres = 0, so every card / list that sums them stays in step.
 */
async function updateStandingAcres(req, res, next) {
  try {
    const { villageAllotmentId } = req.params;
    if (!villageAllotmentId)
      return error(res, 400, allotmentMessages.villageAllotmentIdIsRequired);

    const raw = req.body?.standingAcres;
    const standingAcres = Number(raw);
    if (
      raw === undefined ||
      raw === null ||
      raw === "" ||
      !Number.isFinite(standingAcres) ||
      standingAcres < 0
    ) {
      return error(res, 400, allotmentMessages.standingAcresMustBeANumber0);
    }

    const villageAllotment =
      await AllotmentVillage.findByPk(villageAllotmentId);
    if (!villageAllotment)
      return error(res, 404, allotmentMessages.villageAllotmentNotFound);

    const isAssigned = villageAllotment.supervisorId === req.employee.id;
    if (!isAssigned && !["L1", "L2"].includes(req.employee.level)) {
      return error(
        res,
        403,
        allotmentMessages.youCanOnlyUpdateTheStanding,
      );
    }
    if (villageAllotment.status === "closed") {
      return error(
        res,
        409,
        allotmentMessages.thisAllotmentIsClosedStandingAcres,
      );
    }

    // The standing acres become this village's allotted acres, so the
    // allotment's villages together still can't exceed its required acres.
    const allotment = await Allotment.findByPk(villageAllotment.allotmentId, {
      attributes: ["id", "allotmentId", "reqAcres"],
    });
    const othersTotal =
      Number(
        await AllotmentVillage.sum("allottedAcres", {
          where: {
            allotmentId: villageAllotment.allotmentId,
            id: { [Op.ne]: villageAllotment.id },
          },
        }),
      ) || 0;
    const reqAcres = Number(allotment?.reqAcres) || 0;
    if (othersTotal + standingAcres > reqAcres) {
      return error(
        res,
        409,
        allotmentMessages.acresWouldExceedTheAllotmentS(standingAcres, reqAcres, othersTotal),
      );
    }

    // Standing acres are what is actually on the ground: allotted acres follow
    // them, and nothing is left pending GPS capture (allotted - standing = 0).
    await villageAllotment.update({
      standingAcres,
      allottedAcres: standingAcres,
      gpsPendingAcres: 0,
    });

    return success(res, 200, allotmentMessages.standingAcresUpdatedSuccessfully, {
      data: {
        id: villageAllotment.id,
        allotmentVillageId: villageAllotment.allotmentVillageId,
        allotmentId: villageAllotment.allotmentId,
        allottedAcres: standingAcres,
        standingAcres,
        gpsPendingAcres: 0,
        // allotment-level totals after this change
        reqAcres,
        totalAllottedAcres: othersTotal + standingAcres,
        balanceAcres: reqAcres - (othersTotal + standingAcres),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * A supervisor's village allotments as dropdown options: one line "AL-1001"
 * plus a sub-caption "Village -> Crop -> Variety". Shared by "my allotments"
 * and "allotments of supervisor X" so both return the same shape.
 * Open allotments only — a closed one is never offered to a supervisor.
 */
async function findAllotmentOptions(supervisorId) {
  const rows = await AllotmentVillage.findAll({
    where: { supervisorId, ...OPEN_ALLOTMENT },
    include: [
      {
        model: Village,
        as: "village",
        attributes: ["id", "name", "villageId"],
      },
      {
        model: Allotment,
        as: "allotment",
        attributes: ["id", "allotmentId"],
        include: {
          model: CompanyCrop,
          as: "companyCrop",
          attributes: ["id", "varietyName"],
          include: { model: Crop, as: "crop", attributes: ["id", "name"] },
        },
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return rows.map((row) => ({
    allotmentVillageId: row.id,
    allotmentId: row.allotment?.allotmentId,
    village: row.village?.name,
    crop: row.allotment?.companyCrop?.crop?.name,
    variety: row.allotment?.companyCrop?.varietyName,
    allottedAcres: row.allottedAcres,
    status: row.status,
    supervisorId: row.supervisorId,
  }));
}

/** GET .../allotment-villages — the logged-in supervisor's own allotments. */
const getMyAssignedAllotmentVillages = async (req, res, next) => {
  try {
    const options = await findAllotmentOptions(req.employee.id);
    return success(
      res,
      200,
      allotmentMessages.assignedAllotmentVillagesFetchedSuccessfully,
      {
        data: options,
      },
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Allotment-villages assigned to a supervisor, in the dropdown shape of
 * getMyAssignedAllotmentVillages. Used by:
 *   GET /allotment-villages                     — logged-in user's
 *   GET /allotment-villages?supervisorId=5      — that supervisor's
 *   GET /allotment-villages/:supervisorId       — same, as a path param
 *   GET /loading-requests/supervisors/:supervisorId/allotment-villages
 * Open allotments only.
 */
const getAllotmentVillagesBySupervisor = async (req, res, next) => {
  try {
    // Whose allotments: /:supervisorId, ?supervisorId=, or the logged-in user.
    const supervisorId =
      req.params.supervisorId || req.query.supervisorId || req.employee.id;

    const supervisor = await Employee.findByPk(supervisorId, {
      attributes: ["id", "empId", "name", "level"],
    });
    if (!supervisor) return error(res, 404, allotmentMessages.supervisorNotFound);

    const options = await findAllotmentOptions(supervisor.id);
    return success(
      res,
      200,
      allotmentMessages.supervisorAllotmentVillagesFetchedSuccessfully,
      {
        supervisor,
        data: options,
      },
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET .../supervisors — "Supervisor" dropdown: active L3 supervisors other
 * than the caller (the UI shows the caller as "Self").
 */
const getSupervisorOptions = async (req, res, next) => {
  try {
    const data = await Employee.findAll({
      where: {
        level: "L3",
        status: "Active",
        id: { [Op.ne]: req.employee.id },
      },
      attributes: ["id", "empId", "name", "level"],
      order: [["createdAt", "DESC"]],
    });
    return success(res, 200, allotmentMessages.supervisorsFetchedSuccessfully, { data });
  } catch (err) {
    next(err);
  }
};

const getAllNames = async (req, res, next) => {
  try {
    const [villages, companies, crops] = await Promise.all([
      Village.findAll({
        where: { status: "Active" },
        attributes: ["id", "name"],
      }),
      SeedCompany.findAll({
        where: { status: "Active" },
        attributes: ["id", "name"],
      }),
      Crop.findAll({
        where: { status: "Active" },
        attributes: ["id", "name"],
      }),
    ]);

    const data = {
      villages,
      companies,
      crops,
    };

    return success(res, 200, allotmentMessages.dataFetched, { data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /allotments/summary?companyId=&cropId=&season=&year= — Allotments page
 * KPI cards on their own (the list response also carries them as `summary`).
 * { acresAllotted, standingAcres, balanceAcres, gpsPendingAcres }
 */
const getAllotmentsSummary = async (req, res, next) => {
  try {
    const { companyId, cropId, season, year } = req.query;
    const where = {};
    if (companyId) where.companyId = companyId;
    if (season) where.season = season;
    if (year) where.year = toCropYear(year) || year; // "25-26" (2025 also accepted)

    const data = await getAllotmentSummary(where, cropId);
    return success(res, 200, allotmentMessages.allotmentSummaryFetchedSuccessfully, {
      data,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  updateStandingAcres,
  getVillageAllotmentsByAllotment,
  getAllotmentsSummary,
  getAllAllotments,
  getAllotmentVillageTable,
  getAllotmentById,
  createAllotment,
  updateAllotment,
  deleteAllotment,
  addVillageAllotment,
  updateVillageAllotment,
  getMyAssignedAllotmentVillages,
  getAllotmentVillagesBySupervisor,
  getSupervisorOptions,
  getAllNames,
};

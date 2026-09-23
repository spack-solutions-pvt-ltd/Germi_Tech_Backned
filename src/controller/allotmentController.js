"use strict";
const { Op } = require("sequelize");
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
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

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
function withVillageTotals(allotment) {
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
}

/**
 * List-page cards: Acres allotted / Standing acres / Balance acres / GPS
 * pending acres, aggregated across every Allotment matching the current
 * filters (not just the current page).
 */
async function getAllotmentSummary(where, cropId) {
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
}

/** GET /api/allotments?companyId=&cropId=&season=&year=&search=&page=&limit= */
async function getAllAllotments(req, res, next) {
  try {
    const { search, companyId, cropId, season, year } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (companyId) where.companyId = companyId;
    if (season) where.season = season;
    if (year) where.year = year;
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

    return success(res, 200, "Allotments fetched successfully", {
      ...buildPaginatedResponse({ rows, count: result.count }, page, limit),
      summary,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/allotments/village-table
 * The "Allotted table" tab — a flat list of every village-level allotment
 * row across all allotments. Filters: villageId, companyId, season, year, supervisorId.
 */
async function getAllotmentVillageTable(req, res, next) {
  try {
    const { villageId, companyId, season, year, supervisorId } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (villageId) where.villageId = villageId;
    if (supervisorId) where.supervisorId = supervisorId;

    const allotmentWhere = {};
    if (companyId) allotmentWhere.companyId = companyId;
    if (season) allotmentWhere.season = season;
    if (year) allotmentWhere.year = year;
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
          attributes: ["id", "empId", "name","level"],
        },
      ],
      distinct: true,
      order: [["id", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Allotted villages fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/allotments/:id */
async function getAllotmentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");
    const { search } = req.query;
    const villageWhere = {};

    if (search) {
      const term = `%${search.trim()}%`;
      villageWhere[Op.or] = [
        { "$village.name$": { [Op.like]: term } },
        { $allotmentVillageId$: { [Op.like]: term } },
        { "$subOrganizer.name$": { [Op.like]: term } },
        { "$supervisor.name$": { [Op.like]: term } },
        { "$supervisor.empId$": { [Op.like]: term } },
      ];
    }

    const allotment = await Allotment.findByPk(id, {
      include: [
        ...ALLOTMENT_INCLUDES,
        {
          model: AllotmentVillage,
          where: villageWhere,
          as: "villageAllotments",
          include: [
            {
              model: Village,
              as: "village",
              attributes: ["id", "villageId", "name"],
            },
            {
              model: SubOrganizer,
              as: "subOrganizer",
              attributes: ["id", "name"],
            },
            {
              model: Employee,
              as: "supervisor",
              attributes: ["id", "empId", "name","level"],
            },
          ],
          separate: true,
          order: [["id", "ASC"]],
        },
      ],
    });

    if (!allotment) return error(res, 404, "Allotment not found");

    return success(res, 200, "Allotment fetched successfully", {
      data: withVillageTotals(allotment),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/allotments
 * body: { companyId, companyCropId, reqAcres, reqQtyKgs, season, year }
 */
async function createAllotment(req, res, next) {
  try {
    const { companyId, companyCropId, reqAcres, reqQtyKgs, season, year } =
      req.body;

    if (!companyId) return error(res, 400, "companyId is required");
    if (!companyCropId) return error(res, 400, "companyCropId is required");
    if (!reqAcres) return error(res, 400, "reqAcres is required");
    if (!season) return error(res, 400, "season is required");
    if (!["Kharif", "Rabi"].includes(season))
      return error(res, 400, "season must be Kharif or Rabi");
    if (!year) return error(res, 400, "year is required");

    const company = await SeedCompany.findByPk(companyId);
    if (!company) return error(res, 404, "Seed company not found");

    const companyCrop = await CompanyCrop.findByPk(companyCropId);
    if (!companyCrop) return error(res, 404, "Crop variety not found");
    if (companyCrop.companyId !== Number(companyId)) {
      return error(
        res,
        400,
        "This crop variety does not belong to the selected company",
      );
    }

    const allotment = await Allotment.create({
      companyId,
      companyCropId,
      reqAcres,
      reqQtyKgs,
      season,
      year,
      status: "open",
    });
    const allotmentId = generateId("AL", allotment?.id);
    await allotment.update({ allotmentId });

    const created = await Allotment.findByPk(allotment.id, {
      include: ALLOTMENT_INCLUDES,
    });

    return success(res, 201, "Allotment created successfully", {
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT/PATCH /api/allotments/:id
 * companyId/companyCropId are immutable — they define which allotment this
 * is. Only the requirement numbers and its open/closed state can change.
 */
async function updateAllotment(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

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
    if (!allotment) return error(res, 404, "Allotment not found");

    const { reqAcres, reqQtyKgs, season, year, status } = req.body;

    if (season !== undefined && !["Kharif", "Rabi"].includes(season)) {
      return error(res, 400, "season must be Kharif or Rabi");
    }
    if (status !== undefined && !["open", "closed"].includes(status)) {
      return error(res, 400, "status must be open or closed");
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
          `Cannot reduce required acres below ${currentAllotted}, the amount already allotted to villages`,
        );
      }
    }

    await allotment.update({
      ...(reqAcres !== undefined && { reqAcres }),
      ...(reqQtyKgs !== undefined && { reqQtyKgs }),
      ...(season !== undefined && { season }),
      ...(year !== undefined && { year }),
      ...(status !== undefined && { status }),
    });

    return success(res, 200, "Allotment updated successfully", {
      data: allotment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/allotments/:id
 * Blocked once any village has been allotted, per the spec's rule: "Delete
 * can only be performed before allotting to any village."
 */
async function deleteAllotment(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const allotment = await Allotment.findByPk(id);
    if (!allotment) return error(res, 404, "Allotment not found");

    const villageCount = await AllotmentVillage.count({
      where: { allotmentId: id },
    });
    if (villageCount > 0) {
      return error(
        res,
        409,
        "Cannot delete an allotment that has already been allotted to a village",
      );
    }

    await allotment.destroy();

    return success(res, 200, "Allotment deleted successfully", {
      data: { id: Number(id) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/allotments/:id/villages — the "Allot" button on the single
 * allotment page. body: { villageId, subOrganizerId?, allottedAcres, supervisorId? }
 */
async function addVillageAllotment(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

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
    if (!allotment) return error(res, 404, "Allotment not found");

    const { villageId, subOrganizerId, allottedAcres, supervisorId } = req.body;

    if (!villageId) return error(res, 400, "villageId is required");
    if (allottedAcres === undefined)
      return error(res, 400, "allottedAcres is required");

    const village = await Village.findByPk(villageId);
    if (!village) return error(res, 404, "Village not found");

    if (subOrganizerId !== undefined) {
      const subOrganizer = await SubOrganizer.findByPk(subOrganizerId);
      if (!subOrganizer) return error(res, 404, "Sub organizer not found");
    }

    if (supervisorId !== undefined) {
      const supervisor = await Employee.findByPk(supervisorId);
      if (!supervisor) return error(res, 404, "Supervisor employee not found");
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
        `Allotting ${allottedAcres} acres would exceed the requested ${allotment.reqAcres} acres (already allotted: ${currentAllotted})`,
      );
    }

    // Newly allotted acres start un-verified in the field — standing crop
    // hasn't grown yet and GPS boundary capture hasn't happened yet.
    // Assumption: flag if you want different defaults here.
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
          attributes: ["id", "empId", "name","level"],
        },
      ],
    });

    return success(res, 201, "Village allotted successfully", {
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT/PATCH /api/allotments/:id/villages/:villageAllotmentId
 * Edits one village row's acres/supervisor — the "Edit" action in the
 * Single Allotment page's table.
 */
async function updateVillageAllotment(req, res, next) {
  try {
    const { id, villageAllotmentId } = req.params;
    if (!id) return error(res, 400, "id is required");
    if (!villageAllotmentId)
      return error(res, 400, "villageAllotmentId is required");

    const villageAllotment = await AllotmentVillage.findOne({
      where: { id: villageAllotmentId, allotmentId: id },
    });
    if (!villageAllotment)
      return error(res, 404, "Village allotment not found");

    const {
      allottedAcres,
      standingAcres,
      gpsPendingAcres,
      supervisorId,
      subOrganizerId,
    } = req.body;

    if (supervisorId !== undefined) {
      const supervisor = await Employee.findByPk(supervisorId);
      if (!supervisor) return error(res, 404, "Supervisor employee not found");
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
          `Allotting ${allottedAcres} acres would exceed the requested ${allotment.reqAcres} acres (other villages already hold: ${othersTotal})`,
        );
      }
    }

    await villageAllotment.update({
      ...(allottedAcres !== undefined && { allottedAcres }),
      ...(standingAcres !== undefined && { standingAcres }),
      ...(gpsPendingAcres !== undefined && { gpsPendingAcres }),
      ...(supervisorId !== undefined && { supervisorId }),
      ...(subOrganizerId !== undefined && { subOrganizerId }),
    });

    return success(res, 200, "Village allotment updated successfully", {
      data: villageAllotment,
    });
  } catch (err) {
    next(err);
  }
}

async function getMyAssignedAllotmentVillages(req, res, next) {
  try {

    const rows = await AllotmentVillage.findAll({
      where: { supervisorId: req.employee.id },
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

    // Flatten into exactly the shape the dropdown needs: one line "AL-1001"
    // plus a sub-caption "Village -> Crop -> Variety".
    const options = rows.map((row) => ({
      allotmentVillageId: row.id,
      allotmentId: row.allotment.allotmentId,
      village: row.village.name,
      crop: row.allotment.companyCrop.crop.name,
      variety: row.allotment.companyCrop.varietyName,
      allottedAcres: row.allottedAcres,
    }));

    return success(
      res,
      200,
      "Assigned allotment-villages fetched successfully",
      { data: options },
    );
  } catch (err) {
    next(err);
  }
}

const getAllNames = async (req, res, next) => {
  try {
    const [villages, companies, crops] = await Promise.all([
      Village.findAll({
        attributes: ["id", "name"],
      }),
      SeedCompany.findAll({
        attributes: ["id", "name"],
      }),
      Crop.findAll({
        attributes: ["id", "name"],
      }),
    ]);

    const data = {
      villages,
      companies,
      crops,
    };

    return success(res, 200, "Data Fetched!", { data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAllotments,
  getAllotmentVillageTable,
  getAllotmentById,
  createAllotment,
  updateAllotment,
  deleteAllotment,
  addVillageAllotment,
  updateVillageAllotment,
  getMyAssignedAllotmentVillages,
  getAllNames,
};

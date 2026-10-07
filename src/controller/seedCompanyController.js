"use strict";
const { Op } = require("sequelize");
const {
  SeedCompany,
  Warehouse,
  CompanyCrop,
  Crop,
  Employee,
  State,
  Allotment,
  AllotmentVillage,
} = require("../models");
const { startOfCurrentMonth, resolveSeason, allotmentScope } = require("../utils/periods");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/** GET /api/seed-companies?search=agro&page=1&limit=20 */
const getAllSeedCompanies = async (req, res, next) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { companyId: { [Op.like]: term } },
      ];
    }

    const result = await SeedCompany.findAndCountAll({
      where,
      include: [
        {
          model: Employee,
          as: "creator",
          attributes: ["id", "empId", "name"],
        },
        {
          model: State,
          as: "state",
          attributes: ["id", "name"],
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return success(
      res,
      200,
      "Seed companies fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/seed-companies/:seedCompanyId */
const getSeedCompanyById = async (req, res, next) => {
  try {
    const { seedCompanyId } = req.params;
    if (!seedCompanyId) {
      return error(res, 400, "seedCompanyId is required");
    }

    const company = await SeedCompany.findByPk(seedCompanyId, {
      include: [
        { model: Warehouse, as: "warehouses" },
        {
          model: CompanyCrop,
          as: "companyCrops",
          include: { model: Crop, as: "crop" },
        },
        {
          model: Employee,
          as: "creator",
          attributes: ["id", "empId", "name"],
        },
        {
          model: State,
          as: "state",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!company) {
      return error(res, 404, "Seed company not found");
    }

    // Requirement = required acres of this company's allotments (open
    // allotments by default; ?season=&year= for one season), plus how much of
    // it has been allotted to villages so far.
    const scope = allotmentScope(req.query);
    const allotmentWhere = { ...scope.where, companyId: company.id };
    const [requirementAcres, allottedAcres, allotmentsCount] = await Promise.all([
      Allotment.sum("reqAcres", { where: allotmentWhere }),
      AllotmentVillage.sum("allottedAcres", {
        include: [{ model: Allotment, as: "allotment", attributes: [], where: allotmentWhere }],
      }),
      Allotment.count({ where: allotmentWhere }),
    ]);

    return success(res, 200, "Seed company fetched successfully", {
      data: {
        ...company.toJSON(),
        requirementAcres: Number(requirementAcres) || 0,
        allottedAcres: Number(allottedAcres) || 0,
        balanceAcres: (Number(requirementAcres) || 0) - (Number(allottedAcres) || 0),
        allotmentsCount,
        scope: scope.label,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/seed-companies */
const createSeedCompany = async (req, res, next) => {
  try {
    const {
      name,
      number,
      email,
      pocName,
      pocNumber,
      fullAddress,
      district,
      pincode,
      stateId,
      status,
    } = req.body;
    const employee = req.employee;
    const company = await SeedCompany.create({
      name,
      number,
      email,
      pocName,
      pocNumber,
      fullAddress,
      district,
      pincode,
      stateId,
      status: status || "Active",
      createdBy: employee.id,
    });

    const companyId = generateId("SC", company?.id);
    await company.update({ companyId });

    return success(res, 201, "Seed company created successfully", {
      data: company,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/seed-companies/:id */
const updateSeedCompany = async (req, res, next) => {
  try {
    const { seedCompanyId } = req.params;
    if (!seedCompanyId) return error(res, 400, "seedCompanyId is required");

    const company = await SeedCompany.findByPk(seedCompanyId);
    if (!company) return error(res, 404, "Seed company not found");

    const {
      name,
      number,
      email,
      pocName,
      pocNumber,
      fullAddress,
      district,
      pincode,
      stateId,
      status,
    } = req.body;

    await company.update({
      name,
      number,
      email,
      pocName,
      pocNumber,
      fullAddress,
      district,
      pincode,
      stateId,
      status,
    });

    return success(res, 200, "Seed company updated successfully", {
      data: company,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /seed-company/summary?season=&year= — Seed companies page KPI cards.
 * seasonRequirementAcres = sum of required acres (Allotment.reqAcres) of all
 * company allotments in the season (current season unless ?season=&year= given).
 */
const getSeedCompanySummary = async (req, res, next) => {
  try {
    const season = resolveSeason(req.query);
    const [totalCompanies, inactiveCompanies, newThisMonth, seasonRequirementAcres] = await Promise.all([
      SeedCompany.count(),
      SeedCompany.count({ where: { status: "Inactive" } }),
      SeedCompany.count({ where: { createdAt: { [Op.gte]: startOfCurrentMonth() } } }),
      Allotment.sum("reqAcres", { where: { season: season.season, year: season.year } }),
    ]);

    return success(res, 200, "Seed company summary fetched successfully", {
      data: {
        totalCompanies,
        activeCompanies: totalCompanies - inactiveCompanies,
        inactiveCompanies,
        newThisMonth,
        seasonRequirementAcres: Number(seasonRequirementAcres) || 0,
        season: season.label,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSeedCompanySummary,
  getAllSeedCompanies,
  getSeedCompanyById,
  createSeedCompany,
  updateSeedCompany,
};

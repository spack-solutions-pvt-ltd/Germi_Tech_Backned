"use strict";
const { Op } = require("sequelize");
const {
  SeedCompany,
  Warehouse,
  CompanyCrop,
  Crop,
  Employee,
  State,
} = require("../models");
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

    return success(res, 200, "Seed company fetched successfully", {
      data: company,
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

module.exports = {
  getAllSeedCompanies,
  getSeedCompanyById,
  createSeedCompany,
  updateSeedCompany,
};

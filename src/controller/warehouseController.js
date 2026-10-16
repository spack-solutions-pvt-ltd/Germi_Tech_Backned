"use strict";
const { Op } = require("sequelize");
const { Warehouse, SeedCompany, Employee } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");
const { warehouseMessages } = require("../constants/message/warehouseMessages");

/** GET /api/warehouses?companyId=3&search=cold&page=1&limit=20 */
const getAllWarehouses = async (req, res, next) => {
  try {
    const { companyId, search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (companyId) where.companyId = companyId;
    if (search) where.locationName = { [Op.like]: `%${search}%` };

    const result = await Warehouse.findAndCountAll({
      where,
      include: [
        {
          model: SeedCompany,
          as: "company",
          attributes: ["id", "companyId", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      warehouseMessages.warehousesFetchedSuccessfully,
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/seed-companies/:seedCompanyId/warehouses */
const getWarehousesByCompanyId = async (req, res, next) => {
  try {
    const { seedCompanyId, search } = req.params;
    if (!seedCompanyId) {
      return error(res, 400, warehouseMessages.seedCompanyIdIsRequired);
    }

    const company = await SeedCompany.findByPk(seedCompanyId, {
      include: [
        {
          model: Employee,
          as: "creator",
          attributes: ["id", "empId", "name"],
        },
      ],
    });
    if (!company) {
      return error(res, 404, warehouseMessages.seedCompanyNotFound);
    }

    const where = {};
    where.companyId = seedCompanyId;
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { locationName: { [Op.like]: term } },
        { pocName: { [Op.like]: term } },
      ];
    }

    const { page, limit, offset } = getPagination(req.query);

    const { rows, count } = await Warehouse.findAndCountAll({
      where: where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    const data = {
      company: company,
      warehouses: rows,
    };
    return res.status(200).json({
      success: true,
      message: warehouseMessages.warehousesFetchedSuccessfully,
      data,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.max(Math.ceil(count / limit), 1),
      },
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/warehouses/:id */
const getWarehouseById = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;
    if (!warehouseId) return error(res, 400, warehouseMessages.warehouseIdIsRequired);

    const warehouse = await Warehouse.findByPk(warehouseId);
    if (!warehouse) return error(res, 404, warehouseMessages.warehouseNotFound);

    return success(res, 200, warehouseMessages.warehouseFetchedSuccessfully, {
      data: warehouse,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/warehouses */
const createWarehouse = async (req, res, next) => {
  try {
    const { companyId, locationName, pocName, pocNumber, locationLink } =
      req.body;

    if (!companyId) return error(res, 400, warehouseMessages.companyIdIsRequired);
    if (!locationName) return error(res, 400, warehouseMessages.locationNameIsRequired);

    const company = await SeedCompany.findByPk(companyId);
    if (!company) return error(res, 404, warehouseMessages.seedCompanyNotFound);

    const warehouse = await Warehouse.create({
      companyId,
      locationName,
      pocName,
      pocNumber,
      locationLink,
    });

    const warehouseId = generateId("WH", warehouse.id);
    await warehouse.update({ warehouseId });

    return success(res, 201, warehouseMessages.warehouseCreatedSuccessfully, {
      data: warehouse,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/warehouses/:id */
const updateWarehouse = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;
    if (!warehouseId) return error(res, 400, warehouseMessages.warehouseIdIsRequired);

    const warehouse = await Warehouse.findByPk(warehouseId);
    if (!warehouse) return error(res, 404, warehouseMessages.warehouseNotFound);

    const { locationName, pocName, pocNumber, locationLink } = req.body;

    await warehouse.update({
      ...(locationName !== undefined && { locationName }),
      ...(pocName !== undefined && { pocName }),
      ...(pocNumber !== undefined && { pocNumber }),
      ...(locationLink !== undefined && { locationLink }),
    });

    return success(res, 200, warehouseMessages.warehouseUpdatedSuccessfully, {
      data: warehouse,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllWarehouses,
  getWarehousesByCompanyId,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
};

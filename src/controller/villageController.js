"use strict";
const { Op } = require("sequelize");
const { Village, SubOrganizer, Employee } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/** GET /api/villages?search=kondapur&page=1&limit=20 */
const getAllVillages = async (req, res, next) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { villageId: { [Op.like]: term } },
      ];
    }

    const result = await Village.findAndCountAll({
      where,
      include: [
        { model: Employee, as: "creator", attributes: ["id", "name", "empId"] },
        {
          model: Employee,
          as: "updatedEmp",
          attributes: ["id", "name", "empId"],
        },
        {
          model: SubOrganizer,
          as: "subOrganizers",
          attributes: ["id", "name", "villageId", "acres"],
          separate: true,
        },
      ],
      distinct: true,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // subOrganizers is already a real nested array here
    const rowsWithTotals = result.rows.map((village) => {
      const totalAcresAssigned = (village.subOrganizers || []).reduce(
        (sum, so) => sum + Number(so.acres || 0),
        0,
      );
      return { ...village.toJSON(), totalAcresAssigned };
    });

    return success(
      res,
      200,
      "Villages fetched successfully",
      buildPaginatedResponse(
        { rows: rowsWithTotals, count: result.count },
        page,
        limit,
      ),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/villages/:id */
const getVillageById = async (req, res, next) => {
  try {
    const { villageId } = req.params;
    if (!villageId) return error(res, 400, "villageId is required");

    const village = await Village.findByPk(villageId, {
      include: [
        { model: Employee, as: "creator", attributes: ["id", "name", "empId"] },
        {
          model: Employee,
          as: "updatedEmp",
          attributes: ["id", "name", "empId"],
        },
        { model: SubOrganizer, as: "subOrganizers" },
      ],
    });

    if (!village) return error(res, 404, "Village not found");

    return success(res, 200, "Village fetched successfully", { data: village });
  } catch (err) {
    next(err);
  }
};

/** POST /api/villages */
const createVillage = async (req, res, next) => {
  try {
    const { name, mandal, district, pincode, status } = req.body;

    if (!name) return error(res, 400, "village name is required");

    const village = await Village.create({
      name,
      mandal,
      district,
      pincode,
      status: status || "Active",
      createdBy: req.employee.id,
    });
    const villageId = generateId("VLG", village?.id);
    await village?.update({ villageId });

    return success(res, 201, "Village created successfully", { data: village });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/villages/:id */
const updateVillage = async (req, res, next) => {
  try {
    const { villageId } = req.params;
    if (!villageId) return error(res, 400, "villageId is required");

    const village = await Village.findByPk(villageId);
    if (!village) return error(res, 404, "Village not found");

    const { name, mandal, district, pincode } = req.body;

    await village.update({
      ...(name !== undefined && { name }),
      ...(mandal !== undefined && { mandal }),
      ...(district !== undefined && { district }),
      ...(pincode !== undefined && { pincode }),
      updatedBy: req.employee?.id,
      updatedAt: Date.now(),
    });

    return success(res, 200, "Village updated successfully", { data: village });
  } catch (err) {
    next(err);
  }
};

const updatevillageStatusById = async (req, res, next) => {
  try {
    const { villageId } = req.params;
    if (!villageId)
      return res
        .status(400)
        .json({ status: false, message: "villageId is required" });
    const village = await Village.findByPk(villageId);
    if (!village)
      return res
        .status(404)
        .json({ success: false, message: "Village not found" });
    await village.update({ status: req.body.status });
    return res
      .status(200)
      .json({ success: true, message: "Status updated successfully!" });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getAllVillages,
  getVillageById,
  createVillage,
  updateVillage,
  updatevillageStatusById,
};

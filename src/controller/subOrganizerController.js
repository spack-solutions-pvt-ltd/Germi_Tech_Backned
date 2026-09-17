"use strict";
const { Op } = require("sequelize");
const { SubOrganizer, Village, Employee } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/** GET /api/sub-organizers?villageId=4&search=ramesh&page=1&limit=20 */
const getAllSubOrganizers = async (req, res, next) => {
  try {
    const { villageId, search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (villageId) where.villageId = villageId;
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { subOrganizerId: { [Op.like]: term } },
      ];
    }

    const result = await SubOrganizer.findAndCountAll({
      where,
      include: [
        {
          model: Village,
          as: "village",
          attributes: ["id", "villageId", "name"],
        },
        {
          model: Employee,
          as: "creator",
          attributes: ["id", "empId", "name"],
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return success(
      res,
      200,
      "Sub organizers fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/villages/:villageId/sub-organizers */
const getSubOrganizersByVillageId = async (req, res, next) => {
  try {
    const { villageId } = req.params;
    if (!villageId) return error(res, 400, "villageId is required");

    const village = await Village.findByPk(villageId);
    if (!village) return error(res, 404, "Village not found");

    const { page, limit, offset } = getPagination(req.query);

    const result = await SubOrganizer.findAndCountAll({
      where: { villageId },
      include: [
        { model: Employee, as: "creator", attributes: ["id", "name", "empId"] },
      ],
      order: [["name", "ASC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Sub organizers fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/sub-organizers/:subOrganizerId */
const getSubOrganizerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const subOrganizer = await SubOrganizer.findByPk(id, {
      include: [
        {
          model: Village,
          as: "village",
          attributes: ["id", "villageId", "name"],
        },
        {
          model: Employee,
          as: "creator",
          attributes: ["id", "empId", "name"],
        },
      ],
    });
    if (!subOrganizer) return error(res, 404, "Sub organizer not found");

    return success(res, 200, "Sub organizer fetched successfully", {
      data: subOrganizer,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/sub-organizers */
const createSubOrganizer = async (req, res, next) => {
  try {
    const { villageId, name, number, acres, status } = req.body;

    if (!villageId) return error(res, 400, "villageId is required");
    if (!name) return error(res, 400, "name is required");

    const village = await Village.findByPk(villageId);
    if (!village) return error(res, 404, "Village not found");

    const createdBy = req.employee ? req.employee.id : null; // set once auth middleware is wired in

    const subOrganizer = await SubOrganizer.create({
      villageId,
      name,
      number,
      acres,
      createdBy,
      status: status || "Active",
    });
    const subOrganizerId = await generateId("SUBORG", subOrganizer?.id);
    await subOrganizer.update({ subOrganizerId });

    return success(res, 201, "Sub organizer created successfully", {
      data: subOrganizer,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/sub-organizers/:id */
const updateSubOrganizer = async (req, res, next) => {
  try {
    const { subOrganizerId } = req.params;
    if (!subOrganizerId) return error(res, 400, "subOrganizerId is required");

    const subOrganizer = await SubOrganizer.findByPk(subOrganizerId);
    if (!subOrganizer) return error(res, 404, "Sub organizer not found");

    const { name, number, acres, status, villageId } = req.body;

    await subOrganizer.update({
      ...(name !== undefined && { name }),
      ...(number !== undefined && { number }),
      ...(acres !== undefined && { acres }),
      ...(status !== undefined && { status }),
      ...(villageId !== undefined && { villageId }),
    });

    return success(res, 200, "Sub organizer updated successfully", {
      data: subOrganizer,
    });
  } catch (err) {
    next(err);
  }
};

const updateSubOrganizerStatusById = async (req, res, next) => {
  try {
    const { subOrganizerId } = req.params;
    if (!subOrganizerId)
      return res
        .status(400)
        .json({ status: false, message: "subOrganizerId is required" });
    const subOrganizer = await SubOrganizer.findByPk(subOrganizerId);
    if (!subOrganizer)
      return res
        .status(404)
        .json({ success: false, message: "subOrganizer not found" });
    await subOrganizer.update({ status: req.body.status });
    return res
      .status(200)
      .json({ success: true, message: "Status updated successfully!" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSubOrganizers,
  getSubOrganizersByVillageId,
  getSubOrganizerById,
  createSubOrganizer,
  updateSubOrganizer,
  updateSubOrganizerStatusById,
};

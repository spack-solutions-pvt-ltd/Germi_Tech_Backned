"use strict";
const { Op } = require("sequelize");
const { TaskType } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/** GET /api/task-types?search=field&page=1&limit=20 */
const getAllTaskTypes = async (req, res, next) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { taskTypeId: { [Op.like]: term } },
      ];
    }

    const result = await TaskType.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Task types fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/task-types/:id */
const getTaskTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const taskType = await TaskType.findByPk(id);
    if (!taskType) return error(res, 404, "Task type not found");

    return success(res, 200, "Task type fetched successfully", {
      data: taskType,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/task-types */
const createTaskType = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) return error(res, 400, "name is required");

    const existing = await TaskType.findOne({ where: { name } });
    if (existing)
      return error(res, 409, "A task type with this name already exists");

    const taskType = await TaskType.create({ name, description });
    const taskTypeId = generateId("TT", taskType?.id);
    await taskType.update({ taskTypeId });

    return success(res, 201, "Task type created successfully", {
      data: taskType,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT/PATCH /api/task-types/:id */
const updateTaskType = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const taskType = await TaskType.findByPk(id);
    if (!taskType) return error(res, 404, "Task type not found");

    const { name, description } = req.body;

    if (name !== undefined && name !== taskType.name) {
      const existing = await TaskType.findOne({ where: { name } });
      if (existing)
        return error(res, 409, "A task type with this name already exists");
    }

    await taskType.update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
    });

    return success(res, 200, "Task type updated successfully", {
      data: taskType,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllTaskTypes,
  getTaskTypeById,
  createTaskType,
  updateTaskType,
};

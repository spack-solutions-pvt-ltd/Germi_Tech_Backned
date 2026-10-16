"use strict";
const { Op } = require("sequelize");
const { TaskType } = require("../models");
const {
  getPagination,
  hasPagination,
  statusFilter,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");
const { taskTypeMessages } = require("../constants/message/taskTypeMessages");

/** GET /api/task-types?search=field&page=1&limit=20 */
const getAllTaskTypes = async (req, res, next) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = statusFilter(req.query.status); // ?status=Active|Inactive
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { taskTypeId: { [Op.like]: term } },
      ];
    }

    // No page/limit: every match as { id, taskTypeId, name } for dropdowns.
    if (!hasPagination(req.query)) {
      const data = await TaskType.findAll({
        where,
        order: [["createdAt", "DESC"]],
      });
      return success(res, 200, taskTypeMessages.taskTypesFetchedSuccessfully, { data });
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
      taskTypeMessages.taskTypesFetchedSuccessfully,
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
    if (!id) return error(res, 400, taskTypeMessages.idIsRequired);

    const taskType = await TaskType.findByPk(id);
    if (!taskType) return error(res, 404, taskTypeMessages.taskTypeNotFound);

    return success(res, 200, taskTypeMessages.taskTypeFetchedSuccessfully, {
      data: taskType,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/task-types */
const createTaskType = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    if (!name) return error(res, 400, taskTypeMessages.nameIsRequired);
    statusFilter(status); // 400 unless Active / Inactive (when sent)

    const existing = await TaskType.findOne({ where: { name } });
    if (existing)
      return error(res, 409, taskTypeMessages.aTaskTypeWithThisName);

    const taskType = await TaskType.create({ name, description, status: status || "Active" });
    const taskTypeId = generateId("TT", taskType?.id);
    await taskType.update({ taskTypeId });

    return success(res, 201, taskTypeMessages.taskTypeCreatedSuccessfully, {
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
    if (!id) return error(res, 400, taskTypeMessages.idIsRequired);

    const taskType = await TaskType.findByPk(id);
    if (!taskType) return error(res, 404, taskTypeMessages.taskTypeNotFound);

    const { name, description, status } = req.body;
    statusFilter(status); // 400 unless Active / Inactive (when sent)

    if (name !== undefined && name !== taskType.name) {
      const existing = await TaskType.findOne({ where: { name } });
      if (existing)
        return error(res, 409, taskTypeMessages.aTaskTypeWithThisName);
    }

    await taskType.update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
    });

    return success(res, 200, taskTypeMessages.taskTypeUpdatedSuccessfully, {
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

"use strict";
const { Op } = require("sequelize");
const {
  Task,
  TaskNote,
  TaskType,
  Employee,
  Permission,
  Role,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

const TASK_INCLUDES = [
  {
    model: Employee,
    as: "assignedByEmployee",
    attributes: ["id", "empId", "name", "level"],
  },
  {
    model: Employee,
    as: "assignedToEmployee",
    attributes: ["id", "empId", "name", "level"],
  },
  {
    model: Employee,
    as: "approvedByEmployee",
    attributes: ["id", "empId", "name", "level"],
  },
  { model: TaskType, as: "taskType", attributes: ["id", "name"] },
];

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

/**
 * Lazily flips any Pending task whose due date has passed into Overdue.
 * Runs at the top of every list/detail read — there's no scheduled job
 * doing this in the background yet, so a task only becomes visibly
 * "Overdue" the next time someone loads it. Fine for an admin console;
 * swap for a real cron if you need it to update in real time.
 */
const markOverdueTasks = async () => {
  await Task.update(
    { status: "Overdue" },
    { where: { status: "Pending", dueDate: { [Op.lt]: new Date() } } },
  );
};

const getTaskSummary = async () => {
  const [todayStart, todayEnd] = getTodayRange();

  const [openTasks, dueToday, completed, overdue] = await Promise.all([
    Task.count({ where: { status: { [Op.in]: ["Pending", "Approval"] } } }),
    Task.count({
      where: {
        dueDate: { [Op.between]: [todayStart, todayEnd] },
        status: { [Op.notIn]: ["Completed", "Cancelled"] },
      },
    }),
    Task.count({ where: { status: "Completed" } }),
    Task.count({ where: { status: "Overdue" } }),
  ]);

  return { openTasks, dueToday, completed, overdue };
};

async function getMyTaskSummary(employeeId) {
  const base = { assignedTo: employeeId };

  const [pendingTasks, overdue, reassigned, completed] = await Promise.all([
    Task.count({
      where: { ...base, status: { [Op.in]: ["Pending", "Approval"] } },
    }),
    Task.count({ where: { ...base, status: "Overdue" } }),
    Task.count({ where: { ...base, reassignCount: { [Op.gt]: 0 } } }),
    Task.count({ where: { ...base, status: "Completed" } }),
  ]);

  return { pendingTasks, overdue, reassigned, completed };
}

/**
 * GET /api/tasks/my-tasks
 */
async function getMyTasks(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    await markOverdueTasks();

    const { search, status, taskTypeId } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = { assignedTo: req.employee.id };
    if (search) {
      where[Op.or] = [
        { taskCode: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) where.status = status;
    if (taskTypeId) where.taskTypeId = taskTypeId;

    const [result, summary] = await Promise.all([
      Task.findAndCountAll({
        where,
        include: TASK_INCLUDES,
        order: [["dueDate", "ASC"]],
        limit,
        offset,
      }),
      getMyTaskSummary(req.employee.id),
    ]);

    return success(res, 200, "My tasks fetched successfully", {
      ...buildPaginatedResponse(result, page, limit),
      summary,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tasks?search=TK-33&status=Pending&assignedBy=2&assignedTo=5&taskTypeId=1&page=1&limit=20 */
const getAllTasks = async (req, res, next) => {
  try {
    await markOverdueTasks();

    const { search, status, assignedBy, assignedTo, taskTypeId } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      where[Op.or] = [
        { taskId: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) where.status = status;
    if (assignedBy) where.assignedBy = assignedBy;
    if (assignedTo) where.assignedTo = assignedTo;
    if (taskTypeId) where.taskTypeId = taskTypeId;

    const [result, summary] = await Promise.all([
      Task.findAndCountAll({
        where,
        include: TASK_INCLUDES,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      getTaskSummary(),
    ]);

    return success(res, 200, "Tasks fetched successfully", {
      ...buildPaginatedResponse(result, page, limit),
      summary,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/tasks/:id — full detail + the reassign/reply note thread */
const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    await markOverdueTasks();

    const task = await Task.findByPk(id, {
      include: [
        ...TASK_INCLUDES,
        {
          model: TaskNote,
          as: "notes",
          include: [
            {
              model: Employee,
              as: "author",
              attributes: ["id", "empId", "name", "level"],
            },
          ],
          separate: true,
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!task) return error(res, 404, "Task not found");

    return success(res, 200, "Task fetched successfully", { data: task });
  } catch (err) {
    next(err);
  }
};

// Create the new task
const createTask = async (req, res, next) => {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");
    if (!["L1", "L2"].includes(req.employee.level)) {
      return error(res, 403, "Only L1 or L2 employees can create tasks");
    }

    const { assignedTo, taskTypeId, description, dueDate } = req.body;

    if (!assignedTo) return error(res, 400, "assignedTo is required");
    if (!taskTypeId) return error(res, 400, "taskTypeId is required");
    if (!description) return error(res, 400, "description is required");
    if (!dueDate) return error(res, 400, "dueDate is required");

    const assignee = await Employee.findByPk(assignedTo);
    if (!assignee) return error(res, 404, "assignedTo employee not found");
    // Assignee can be any level (L1, L2, or L3) — only the assigner is
    // restricted to L1/L2. L3 employees can't create tasks, but they can
    // certainly be assigned one, same as anyone else.

    const taskType = await TaskType.findByPk(taskTypeId);
    if (!taskType) return error(res, 404, "Task type not found");

    const task = await Task.create({
      assignedBy: req.employee.id,
      assignedTo,
      taskTypeId,
      description,
      assignedDate: new Date(),
      dueDate,
      status: "Pending",
    });
    const taskId = await generateId("TK", task?.id);
    await task.update({ taskId });

    const created = await Task.findByPk(task.id, { include: TASK_INCLUDES });

    return success(res, 201, "Task created successfully", { data: created });
  } catch (err) {
    next(err);
  }
};
const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const task = await Task.findByPk(id);
    if (!task) return error(res, 404, "Task not found");

    const isCreatorOrL1 =
      task.assignedBy === req.employee.id || req.employee.level === "L1";
    if (!isCreatorOrL1) {
      return error(
        res,
        403,
        "Only the task's creator or an L1 employee can edit it",
      );
    }
    const employee = await Employee.findByPk(req.employee.id, {
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["id"],
          include: [
            { model: Permission, as: "permissions", attributes: ["code"] },
          ],
        },
      ],
    });
    console.log(employee, "employee");

    if (!["Pending", "Overdue"].includes(task.status)) {
      return error(
        res,
        409,
        `Cannot edit a task with status "${task.status}". Use reassign or cancel instead.`,
      );
    }

    const { assignedTo, taskTypeId, description, dueDate } = req.body;

    if (assignedTo !== undefined) {
      const assignee = await Employee.findByPk(assignedTo);
      if (!assignee) return error(res, 404, "assignedTo employee not found");
      // No level restriction on the assignee — see createTask for why.
    }

    if (taskTypeId !== undefined) {
      const taskType = await TaskType.findByPk(taskTypeId);
      if (!taskType) return error(res, 404, "Task type not found");
    }

    await task.update({
      ...(assignedTo !== undefined && { assignedTo }),
      ...(taskTypeId !== undefined && { taskTypeId }),
      ...(description !== undefined && { description }),
      ...(dueDate !== undefined && { dueDate }),
    });

    const updated = await Task.findByPk(task.id, { include: TASK_INCLUDES });

    return success(res, 200, "Task updated successfully", { data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * action is one of: submit | accept | reassign | cancel
 */
const updateTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const task = await Task.findByPk(id);
    if (!task) return error(res, 404, "Task not found");

    const { action, note } = req.body;
    if (!action) return error(res, 400, "action is required");

    const actorId = req.employee.id;
    const actorLevel = req.employee.level;
    const isCreatorOrL1 = task.assignedBy === actorId || actorLevel === "L1";

    switch (action) {
      case "submit": {
        if (task.assignedTo !== actorId) {
          return error(
            res,
            403,
            "Only the assigned employee can submit this task",
          );
        }
        if (task.status !== "Pending" && task.status !== "Overdue") {
          return error(
            res,
            409,
            `Cannot submit a task with status "${task.status}"`,
          );
        }
        if (!note) return error(res, 400, "note is required to submit a task");

        await TaskNote.create({
          taskId: task.id,
          authorId: actorId,
          noteType: "submission",
          message: note,
        });
        await task.update({ status: "Approval" });
        break;
      }

      case "accept": {
        if (!isCreatorOrL1) {
          return error(
            res,
            403,
            "Only the task's creator or an L1 employee can accept it",
          );
        }
        if (task.status !== "Approval") {
          return error(
            res,
            409,
            `Cannot accept a task with status "${task.status}"`,
          );
        }

        await task.update({ status: "Completed", approvedBy: actorId });
        break;
      }

      case "reassign": {
        if (!isCreatorOrL1) {
          return error(
            res,
            403,
            "Only the task's creator or an L1 employee can reassign it",
          );
        }
        if (!["Approval", "Pending", "Overdue"].includes(task.status)) {
          return error(
            res,
            409,
            `Cannot reassign a task with status "${task.status}"`,
          );
        }
        if (!note)
          return error(res, 400, "note is required to reassign a task");

        const { assignedTo, dueDate } = req.body;
        if (assignedTo !== undefined) {
          const newAssignee = await Employee.findByPk(assignedTo);
          if (!newAssignee)
            return error(res, 404, "assignedTo employee not found");
          // No level restriction here either — see createTask for why.
        }

        await TaskNote.create({
          taskId: task.id,
          authorId: actorId,
          noteType: "reassign",
          message: note,
        });
        await task.update({
          status: "Pending",
          reassignCount: task.reassignCount + 1,
          ...(assignedTo !== undefined && { assignedTo }),
          ...(dueDate !== undefined && { dueDate }),
        });
        break;
      }

      case "cancel": {
        if (!isCreatorOrL1) {
          return error(
            res,
            403,
            "Only the task's creator or an L1 employee can cancel it",
          );
        }
        if (["Completed", "Cancelled"].includes(task.status)) {
          return error(
            res,
            409,
            `Cannot cancel a task with status "${task.status}"`,
          );
        }

        if (note) {
          await TaskNote.create({
            taskId: task.id,
            authorId: actorId,
            noteType: "cancel",
            message: note,
          });
        }
        await task.update({ status: "Cancelled" });
        break;
      }

      default:
        return error(
          res,
          400,
          "action must be one of: submit, accept, reassign, cancel",
        );
    }

    const updated = await Task.findByPk(task.id, {
      include: [
        ...TASK_INCLUDES,
        {
          model: TaskNote,
          as: "notes",
          include: [
            {
              model: Employee,
              as: "author",
              attributes: ["id", "empId", "name", "level"],
            },
          ],
          separate: true,
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    return success(res, 200, `Task ${action} applied successfully`, {
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTaskStatus,
  getMyTasks,
  updateTask,
};

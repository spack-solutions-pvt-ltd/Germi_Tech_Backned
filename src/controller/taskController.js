"use strict";
const { Op } = require("sequelize");
const {
  Task,
  TaskNote,
  TaskType,
  Employee,
  Role,
  Permission,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const {
  getEffectivePermissionCodes,
} = require("../middleWare/auth.middleware");
const { success, error } = require("../utils/response");

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

// To set the tasks into overdue
async function markOverdueTasks() {
  await Task.update(
    { status: "Overdue" },
    { where: { status: "Pending", dueDate: { [Op.lt]: new Date() } } },
  );
}

/**
 * The Global Task List's 4 cards: Open tasks / Pending approval / Completed
 * / Total tasks. "Open" and "Pending approval" are mutually exclusive
 * (Pending only vs Approval only) — they don't overlap with each other, and
 * neither counts Overdue/Cancelled tasks individually, but "Total tasks"
 * counts everything regardless of status, so the four numbers won't always
 * sum evenly if there are Overdue/Cancelled tasks in the mix.
 *
 * baseWhere lets the cards be scoped the same way as the list itself —
 * e.g. { assignedBy: employeeId } for someone without global_view, so the
 * numbers on the cards always match what's actually in the table below them.
 */
async function getTaskSummary(baseWhere = {}) {
  const [openTasks, pendingApproval, completed, totalTasks] = await Promise.all(
    [
      Task.count({ where: { ...baseWhere, status: "Pending" } }),
      Task.count({ where: { ...baseWhere, status: "Approval" } }),
      Task.count({ where: { ...baseWhere, status: "Completed" } }),
      Task.count({ where: baseWhere }),
    ],
  );

  return { openTasks, pendingApproval, completed, totalTasks };
}

/**
 * Flattens a task into one chronological, chat-ready thread: the initial
 * assignment (Task.description, authored by whoever assigned it) followed
 * by every TaskNote in order (submissions, reassignments, cancellation) —
 * however many times it's been reassigned and resubmitted. The frontend
 * renders this as a single message list; it doesn't need to separately
 * reason about `description` vs `notes` or reconstruct the ordering itself.
 */
function buildTaskConversation(task) {
  const conversation = [
    {
      type: "description",
      author: task.assignedByEmployee
        ? {
            id: task.assignedByEmployee.id,
            empId: task.assignedByEmployee.empId,
            name: task.assignedByEmployee.name,
            level: task.assignedByEmployee.level,
          }
        : null,
      message: task.description,
      createdAt: task.assignedDate || task.createdAt,
    },
  ];

  (task.notes || []).forEach((note) => {
    conversation.push({
      type: note.noteType, // "submission" | "reassign" | "cancel"
      author: note.author
        ? {
            id: note.author.id,
            empId: note.author.empId,
            name: note.author.name,
            level: note.author.level,
          }
        : null,
      message: note.message,
      createdAt: note.createdAt,
    });
  });

  return conversation;
}

/**
 * The TaskNote include used everywhere the chat thread is needed — kept in
 * one place so getTaskById and updateTaskStatus can't drift apart.
 */
const TASK_NOTES_INCLUDE = {
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
};

/**
 * Attaches the ready-to-render `conversation` array to a task's JSON,
 * without dropping the raw `description`/`notes` fields — some frontend
 * consumers may still want those directly.
 */
function withConversation(task) {
  return { ...task.toJSON(), conversation: buildTaskConversation(task) };
}

/**
 * The My Tasks page's 4 cards: Pending tasks / Over due / Reassigned / Completed.
 * Different shape from getTaskSummary (the Global Task List's cards) —
 * "Reassigned" has no equivalent there, and there's no "due today" card here.
 */
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
 * GET /api/tasks/my-tasks?search=&status=&taskTypeId=&page=&limit=
 */
async function getMyTasks(req, res, next) {
  try {
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

    const [result, kpis] = await Promise.all([
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
      kpis,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tasks?search=&status=&assignedBy=&assignedTo=&taskTypeId=&page=&limit= */
async function getAllTasks(req, res, next) {
  try {
    await markOverdueTasks();

    // Same permission rule as updateTask, fetched fresh for the same
    const employeeWithPermissions = await Employee.findByPk(req.employee.id, {
      include: {
        model: Role,
        as: "role",
        include: { model: Permission, as: "permissions" },
      },
    });
    if (!employeeWithPermissions) return error(res, 404, "Employee not found");

    const rolePermissions = employeeWithPermissions.role
      ? employeeWithPermissions.role.permissions
      : [];
    const effectiveCodes = await getEffectivePermissionCodes(
      req.employee.id,
      rolePermissions,
    );
    const hasGlobalView = effectiveCodes.has("task_management.global_view");

    const { search, status, assignedBy, assignedTo, taskTypeId } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      where[Op.or] = [
        { taskCode: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (taskTypeId) where.taskTypeId = taskTypeId;

    if (hasGlobalView) {
      // Full visibility — assignedBy is just an optional filter here.
      if (assignedBy) where.assignedBy = assignedBy;
    } else {
      where.assignedBy = req.employee.id;
    }

    const [result, kpis] = await Promise.all([
      Task.findAndCountAll({
        where,
        include: TASK_INCLUDES,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      getTaskSummary(hasGlobalView ? {} : { assignedBy: req.employee.id }),
    ]);

    return success(res, 200, "Tasks fetched successfully", {
      ...buildPaginatedResponse(result, page, limit),
      kpis,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tasks/:id */
async function getTaskById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    await markOverdueTasks();

    const task = await Task.findByPk(id, {
      include: [...TASK_INCLUDES, TASK_NOTES_INCLUDE],
    });

    if (!task) return error(res, 404, "Task not found");

    return success(res, 200, "Task fetched successfully", {
      data: withConversation(task),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks
 */
async function createTask(req, res, next) {
  try {
    const { assignedTo, taskTypeId, description, dueDate } = req.body;

    if (!assignedTo) return error(res, 400, "assignedTo is required");
    if (!taskTypeId) return error(res, 400, "taskTypeId is required");
    if (!description) return error(res, 400, "description is required");
    if (!dueDate) return error(res, 400, "dueDate is required");

    const assignee = await Employee.findByPk(assignedTo);
    if (!assignee) return error(res, 404, "assignedTo employee not found");

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
    const taskId = generateId("TK", task?.id);
    await task.update({ taskId });

    const created = await Task.findByPk(task.id, { include: TASK_INCLUDES });

    return success(res, 201, "Task created successfully", { data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT/PATCH /api/tasks/:id
 */
async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const task = await Task.findByPk(id);
    if (!task) return error(res, 404, "Task not found");

    // to get the employee permissions
    const employeeWithPermissions = await Employee.findByPk(req.employee.id, {
      include: {
        model: Role,
        as: "role",
        include: { model: Permission, as: "permissions" },
      },
    });
    if (!employeeWithPermissions) return error(res, 404, "Employee not found");

    const rolePermissions = employeeWithPermissions.role
      ? employeeWithPermissions.role.permissions
      : [];
    const effectiveCodes = await getEffectivePermissionCodes(
      req.employee.id,
      rolePermissions,
    );

    const hasEdit = effectiveCodes.has("task_management.edit");
    const hasGlobalView = effectiveCodes.has("task_management.global_view");
    const isOwnTask = task.assignedBy === req.employee.id;

    const canEdit = hasEdit && (isOwnTask || hasGlobalView);

    if (!canEdit) {
      return error(
        res,
        403,
        "You need task_management.edit (for tasks you created) or both task_management.global_view and task_management.edit (to edit any task)",
      );
    }

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
}

/**
 * PUT /api/tasks/:id/status — the single "Action" endpoint behind the side
 */
async function updateTaskStatus(req, res, next) {
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
        if (
          task.status !== "Pending" &&
          task.status !== "Overdue" &&
          task.status !== "Reassigned"
        ) {
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
        // if (!isCreatorOrL1) {
        //   return error(
        //     res,
        //     403,
        //     "Only the task's creator or an L1 employee can reassign it",
        //   );
        // }
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
          status: "Reassigned",
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
      include: [...TASK_INCLUDES, TASK_NOTES_INCLUDE],
    });

    return success(res, 200, `Task ${action} applied successfully`, {
      data: withConversation(updated),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTasks,
  getMyTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
};

"use strict";
const { Router } = require("express");
const { taskRoutes } = require("../constants/routes");
const {
  getTasksSummary,
  getMyTasksSummary,
  getAllTasks,
  getTaskById,
  createTask,
  updateTaskStatus,
  getMyTasks,
  updateTask,
} = require("../controller/taskController");
// const { requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get(taskRoutes.summary, getTasksSummary); // KPI cards — before /:id
router.get(taskRoutes.root, getAllTasks);
router.get(taskRoutes.myTasks, getMyTasks);
router.get(taskRoutes.mySummary, getMyTasksSummary); // My Tasks KPI cards
router.get(taskRoutes.byId, getTaskById);
router.post(taskRoutes.root, createTask);
router.put(taskRoutes.byId, updateTask);
router.put(taskRoutes.statusById, updateTaskStatus);

module.exports = router;

"use strict";
const { Router } = require("express");
const { taskTypeRoutes } = require("../constants/routes");
const {
  getAllTaskTypes,
  getTaskTypeById,
  createTaskType,
  updateTaskType,
} = require("../controller/taskTypeController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get(taskTypeRoutes.root, getAllTaskTypes);
router.get(taskTypeRoutes.byId, getTaskTypeById);
router.post(taskTypeRoutes.root, createTaskType);
router.put(taskTypeRoutes.byId, updateTaskType);

module.exports = router;
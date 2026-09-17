"use strict";
const { Router } = require("express");
const {
  getAllTasks,
  getTaskById,
  createTask,
  updateTaskStatus,
  getMyTasks,
  updateTask,
} = require("../controller/taskController");
// const { requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get("/", getAllTasks);
router.get("/my-tasks", getMyTasks);
router.get("/:id", getTaskById);
router.post("/", createTask);
router.put("/:id", updateTask);
router.put("/:id/status", updateTaskStatus);

module.exports = router;

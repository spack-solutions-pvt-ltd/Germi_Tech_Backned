"use strict";
const { Router } = require("express");
const {
  getAllTaskTypes,
  getTaskTypeById,
  createTaskType,
  updateTaskType,
} = require("../controller/taskTypeController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get("/", getAllTaskTypes);
router.get("/:id", getTaskTypeById);
router.post("/", createTaskType);
router.put("/:id", updateTaskType);

module.exports = router;
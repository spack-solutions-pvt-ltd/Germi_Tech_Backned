"use strict";
const { Router } = require("express");
const {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  getResponsesByNotification,
  createNotificationResponse,
} = require("../controller/notificationController");
const { notificationImageUpload } = require("../middleWare/upload.middleware");

const router = Router();

router.get("/", getAllNotifications);
router.get("/:id", getNotificationById);
router.post("/", notificationImageUpload, createNotification);
router.put("/:id", notificationImageUpload, updateNotification);

router.get("/:notificationId/responses", getResponsesByNotification);
router.post("/:notificationId/responses", createNotificationResponse);

module.exports = router;

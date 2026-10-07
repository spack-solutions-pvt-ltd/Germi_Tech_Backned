"use strict";
const { Router } = require("express");
const {
  getNotificationsSummary,
  getAllNotifications,
  getMyNotifications,
  downloadNotificationDocument,
  getNotificationById,
  createNotification,
  updateNotification,
  getResponsesByNotification,
  createNotificationResponse,
} = require("../controller/notificationController");
const { notificationUpload } = require("../middleWare/upload.middleware");

const router = Router();

router.get("/summary", getNotificationsSummary);
router.get("/", getAllNotifications);
router.get("/my-notifications", getMyNotifications);
router.get("/:id", getNotificationById);
router.get("/:id/document", downloadNotificationDocument);
router.post("/", notificationUpload, createNotification); // files: image?, document?
router.put("/:id", notificationUpload, updateNotification);

router.get("/:notificationId/responses", getResponsesByNotification);
router.post("/:notificationId/responses", createNotificationResponse);

module.exports = router;

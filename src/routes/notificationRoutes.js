"use strict";
const { Router } = require("express");
const { notificationRoutes } = require("../constants/routes");
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

router.get(notificationRoutes.summary, getNotificationsSummary);
router.get(notificationRoutes.root, getAllNotifications);
router.get(notificationRoutes.myNotifications, getMyNotifications);
router.get(notificationRoutes.byId, getNotificationById);
router.get(notificationRoutes.documentById, downloadNotificationDocument);
router.post(notificationRoutes.root, notificationUpload, createNotification); // files: image?, document?
router.put(notificationRoutes.byId, notificationUpload, updateNotification);

router.get(notificationRoutes.responsesByNotificationId, getResponsesByNotification);
router.post(notificationRoutes.responsesByNotificationId, createNotificationResponse);

module.exports = router;

"use strict";
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "employee-documents");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${req.params.id}-${file.fieldname}-${Date.now()}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WEBP or PDF files are allowed"));
    }
    cb(null, true);
  },
});

// Field names match the EmployeeDocument.type enum exactly, one file each.
const employeeDocumentUpload = upload.fields([
  { name: "aadhar", maxCount: 1 },
  { name: "drivers_license", maxCount: 1 },
  { name: "rc", maxCount: 1 },
  { name: "other", maxCount: 1 },
]);

// Single image attached to a broadcast notification.
const NOTIFICATION_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "notifications");
fs.mkdirSync(NOTIFICATION_UPLOAD_DIR, { recursive: true });

const notificationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, NOTIFICATION_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `notification-${Date.now()}${ext}`);
  },
});

const notificationImageUpload = multer({
  storage: notificationStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WEBP or PDF files are allowed"));
    }
    cb(null, true);
  },
}).single("image");

module.exports = {
  employeeDocumentUpload,
  notificationImageUpload,
  UPLOAD_DIR,
  NOTIFICATION_UPLOAD_DIR,
};
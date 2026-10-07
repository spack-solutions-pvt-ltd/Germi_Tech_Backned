"use strict";
const path = require("path");
const { createS3Upload, IMAGE_OR_PDF } = require("./s3Upload.middleware");
const { S3_FOLDERS } = require("../utils/s3");

// Employee documents (Aadhaar, licence, RC, ...) are ID proofs, so they are
// PRIVATE: stored in S3 with no public URL. Save file.key; the API hands out
// short-lived signed links to view / download them.
const employeeDocumentFileUpload = createS3Upload({
  folder: S3_FOLDERS.employeeDocuments,
  single: "document",
  maxSizeMb: 10,
  isPrivate: true,
});

// Multi-field variant (one file per EmployeeDocument.type), same rules.
const employeeDocumentUpload = createS3Upload({
  folder: S3_FOLDERS.employeeDocuments,
  fields: [
    { name: "aadhar", maxCount: 1 },
    { name: "drivers_license", maxCount: 1 },
    { name: "rc", maxCount: 1 },
    { name: "other", maxCount: 1 },
  ],
  maxSizeMb: 10,
  isPrivate: true,
});

// Broadcast notification attachments: an optional image + an optional
// downloadable document. Public via CloudFront; the document is served as a
// download under its original file name.
const notificationUpload = createS3Upload({
  folder: S3_FOLDERS.notifications,
  fields: [
    { name: "image", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ],
  allowed: {
    image: { extensions: [".jpg", ".jpeg", ".png", ".webp"], label: "JPEG, PNG or WEBP" },
    document: {
      extensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".txt"],
      label: "PDF, Word, Excel, CSV, PowerPoint or text",
    },
  },
  maxSizeMb: 10,
  downloadFields: ["document"],
});

// Where files uploaded before S3 live on disk (still served for old rows).
const LEGACY_UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

module.exports = {
  employeeDocumentFileUpload,
  employeeDocumentUpload,
  notificationUpload,
  IMAGE_OR_PDF,
  LEGACY_UPLOAD_ROOT,
};

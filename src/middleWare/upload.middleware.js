"use strict";
const { createS3Upload } = require("./s3Upload.middleware");
const { S3_FOLDERS } = require("../utils/s3");

// Employee documents (Aadhaar, licence, RC, ...): one file per upload.
// They are ID proofs, so the API only hands out short-lived links to them.
const employeeDocumentFileUpload = createS3Upload({
  folder: S3_FOLDERS.employeeDocuments,
  single: "document",
  maxSizeMb: 10,
});

// Notification attachments: an optional image + an optional document that
// downloads under its original file name.
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

module.exports = { employeeDocumentFileUpload, notificationUpload };

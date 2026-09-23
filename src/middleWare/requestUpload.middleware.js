"use strict";
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function makeStorage(subfolder) {
  const dir = path.join(__dirname, "..", "uploads", subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${unique}${ext}`);
    },
  });
}

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only JPEG, PNG, WEBP or PDF files are allowed"));
  }
  cb(null, true);
}

const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB per file

// Labour request: Start Photo + End Photo
const labourRequestUpload = multer({ storage: makeStorage("labour-requests"), limits, fileFilter }).fields([
  { name: "start_photo", maxCount: 1 },
  { name: "end_photo", maxCount: 1 },
]);

// Expense request: Bill (single upload)
const expenseRequestUpload = multer({ storage: makeStorage("expense-requests"), limits, fileFilter }).single("bill");

// Loading request: Start Photo + End Photo, plus one DK Photo per repeatable
// row. dk_photo is sent as a multi-file field — file at array index N
// belongs to entries[N] in the JSON payload. The client must keep these in
// the same order.
const loadingRequestUpload = multer({ storage: makeStorage("loading-requests"), limits, fileFilter }).fields([
  { name: "start_photo", maxCount: 1 },
  { name: "end_photo", maxCount: 1 },
  { name: "dk_photo", maxCount: 20 },
]);

module.exports = { labourRequestUpload, expenseRequestUpload, loadingRequestUpload };
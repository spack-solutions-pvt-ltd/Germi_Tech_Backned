"use strict";
const { createS3Upload } = require("./s3Upload.middleware");
const { S3_FOLDERS } = require("../utils/s3");

// Request attachments, stored in S3 under one folder per request type and
// served through CloudFront. Each file ends up with file.url (save this).

// Labour request: Start Photo + End Photo
const labourRequestUpload = createS3Upload({
  folder: S3_FOLDERS.labourRequests,
  fields: [
    { name: "start_photo", maxCount: 1 },
    { name: "end_photo", maxCount: 1 },
  ],
});

// Expense request: Bill (single upload)
const expenseRequestUpload = createS3Upload({
  folder: S3_FOLDERS.expenseRequests,
  single: "bill",
});

// Loading request: Start Photo + End Photo, plus one DK Photo per row that
// has one (rows point at their file with dkPhotoIndex).
const loadingRequestUpload = createS3Upload({
  folder: S3_FOLDERS.loadingRequests,
  fields: [
    { name: "start_photo", maxCount: 1 },
    { name: "end_photo", maxCount: 1 },
    { name: "dk_photo", maxCount: 20 },
  ],
});

module.exports = { labourRequestUpload, expenseRequestUpload, loadingRequestUpload };

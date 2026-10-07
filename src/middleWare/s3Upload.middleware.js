"use strict";
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const {
  isS3Configured,
  uploadToS3,
  generateFileKey,
  LOCAL_UPLOAD_ROOT,
} = require("../utils/s3");

// Upload middleware factory. After it runs, every file in req.file / req.files
// has file.key — the value controllers save in the database:
//   S3 configured: the S3 key, e.g. "labour-requests/start_photo-1730…-3f9a.jpg"
//   otherwise:     a local path, "/uploads/labour-requests/start_photo-….jpg"
// Reading it back as a link is done by getFileUrl (see utils/s3.js).

if (!isS3Configured()) {
  console.warn("[uploads] AWS S3 is not configured — saving uploads to src/uploads on this machine.");
}

const IMAGE_OR_PDF = {
  extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
  label: "JPEG, PNG, WEBP or PDF",
};

/** Local fallback: saves to src/uploads/<folder>/ and returns "/uploads/<folder>/<name>". */
async function saveLocally(file, folder) {
  const key = generateFileKey(folder, file);
  await fs.mkdir(path.join(LOCAL_UPLOAD_ROOT, folder), { recursive: true });
  await fs.writeFile(path.join(LOCAL_UPLOAD_ROOT, key), file.buffer);
  return `/uploads/${key}`;
}

function fileFilter(allowedByField) {
  return (req, file, cb) => {
    const allowed = allowedByField[file.fieldname] || allowedByField["*"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed || !allowed.extensions.includes(ext)) {
      return cb(new Error(`${file.fieldname}: only ${allowed?.label || "known"} files are allowed`));
    }
    cb(null, true);
  };
}

/**
 * @param {object}   opts
 * @param {string}   opts.folder           folder in the bucket (see S3_FOLDERS)
 * @param {Array}    [opts.fields]         multer .fields() spec, e.g. [{ name: "start_photo", maxCount: 1 }]
 * @param {string}   [opts.single]         field name for a single-file upload
 * @param {object}   [opts.allowed]        { fieldName | "*": { extensions, label } } — default images + PDF
 * @param {number}   [opts.maxSizeMb]      per-file limit (default 5)
 * @param {string[]} [opts.downloadFields] fields the browser should download (original name) instead of open
 */
function createS3Upload({
  folder,
  fields,
  single,
  allowed = { "*": IMAGE_OR_PDF },
  maxSizeMb = 5,
  downloadFields = [],
}) {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: fileFilter(allowed),
  });
  const parse = single ? parser.single(single) : parser.fields(fields);

  return (req, res, next) => {
    parse(req, res, async (parseErr) => {
      if (parseErr) {
        parseErr.statusCode = 400; // bad type / too large / unexpected field
        return next(parseErr);
      }
      try {
        const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
        await Promise.all(
          files.map(async (file) => {
            file.key = isS3Configured()
              ? await uploadToS3(file, folder, { asAttachment: downloadFields.includes(file.fieldname) })
              : await saveLocally(file, folder);
            delete file.buffer; // free memory once it's stored
          }),
        );
        next();
      } catch (err) {
        next(err);
      }
    });
  };
}

module.exports = { createS3Upload, IMAGE_OR_PDF };

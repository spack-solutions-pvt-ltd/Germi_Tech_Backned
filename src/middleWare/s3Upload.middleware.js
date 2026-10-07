"use strict";
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const { uploadFile, isS3Configured, buildKey } = require("../utils/s3");

// Builds an upload middleware that stores files in S3 instead of on disk.
// After it runs, every file in req.file / req.files has:
//   file.key  — the S3 key, e.g. "labour-requests/start_photo-1730…-3f9a.jpg"
//   file.url  — the value to save for a public file (the S3 key; null for
//               private uploads). Models resolve it to the CloudFront URL on read.
// Controllers save file.url (public) or file.key (private) in the database.
//
// Local fallback: when AWS isn't configured (no AWS_REGION / AWS_S3_BUCKET in
// .env), files are saved under src/uploads/<folder>/ instead and both
// file.key and file.url are "/uploads/<folder>/<name>" — the same paths the
// app already serves and handles for files from before S3.

const LOCAL_UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

if (!isS3Configured()) {
  console.warn("[uploads] AWS S3 is not configured — saving uploads to src/uploads on this machine.");
}

/** Saves to src/uploads/<folder>/ and returns the "/uploads/..." path. */
async function saveLocally(file, folder) {
  const relative = buildKey(folder, file); // "<folder>/<field>-<time>-<rand>.<ext>"
  await fs.mkdir(path.join(LOCAL_UPLOAD_ROOT, folder), { recursive: true });
  await fs.writeFile(path.join(LOCAL_UPLOAD_ROOT, relative), file.buffer);
  return `/uploads/${relative}`;
}

const IMAGE_OR_PDF = {
  extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
  label: "JPEG, PNG, WEBP or PDF",
};

function makeFileFilter(allowedByField) {
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
 * @param {string}   opts.folder          S3 folder (see S3_FOLDERS)
 * @param {Array}    [opts.fields]        multer .fields() spec, e.g. [{ name: "start_photo", maxCount: 1 }]
 * @param {string}   [opts.single]        field name for a single-file upload
 * @param {object}   [opts.allowed]       { fieldName | "*": { extensions, label } } — default images + PDF
 * @param {number}   [opts.maxSizeMb]     per-file limit (default 5)
 * @param {boolean}  [opts.isPrivate]     true = no public URL (served via signed links only)
 * @param {string[]} [opts.downloadFields] fields served as downloads under their original name
 */
function createS3Upload({
  folder,
  fields,
  single,
  allowed = { "*": IMAGE_OR_PDF },
  maxSizeMb = 5,
  isPrivate = false,
  downloadFields = [],
}) {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: makeFileFilter(allowed),
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
        const useS3 = isS3Configured();
        await Promise.all(
          files.map(async (file) => {
            if (useS3) {
              file.key = await uploadFile(file, folder, {
                asAttachment: downloadFields.includes(file.fieldname),
              });
              // Public files: save the S3 key; the model getter turns it into
              // the CloudFront URL when the data is read (see fileUrlAttribute).
              file.url = isPrivate ? null : file.key;
            } else {
              // Local fallback: the "/uploads/..." path works as both key and URL.
              file.key = await saveLocally(file, folder);
              file.url = file.key;
            }
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

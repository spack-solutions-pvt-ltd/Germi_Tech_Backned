"use strict";
const path = require("path");
const crypto = require("crypto");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// All file storage goes through here: S3 holds the files, CloudFront serves
// the public ones. Required env:
//   AWS_REGION, AWS_S3_BUCKET, CLOUDFRONT_URL (e.g. https://dxxxx.cloudfront.net)
//   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY — optional when the server runs
//   with an IAM role (EC2 instance profile); the SDK picks credentials up itself.

// One "folder" (key prefix) per kind of upload.
const S3_FOLDERS = {
  employeeDocuments: "employee-documents",
  notifications: "notifications",
  labourRequests: "labour-requests",
  expenseRequests: "expense-requests",
  loadingRequests: "loading-requests",
};

const BUCKET = process.env.AWS_S3_BUCKET;
const CLOUDFRONT_URL = (process.env.CLOUDFRONT_URL || "").replace(/\/+$/, "");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

/** True when AWS_REGION and AWS_S3_BUCKET are set — otherwise uploads fall back to local disk. */
function isS3Configured() {
  return Boolean(BUCKET && process.env.AWS_REGION);
}

function assertConfigured() {
  if (!BUCKET || !process.env.AWS_REGION) {
    const err = new Error("File storage is not configured (AWS_REGION / AWS_S3_BUCKET missing)");
    err.statusCode = 500;
    throw err;
  }
}

/** labour-requests/start_photo-1730000000000-3f9a1c2b.jpg — unique, never overwritten. */
function buildKey(folder, file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return `${folder}/${file.fieldname}-${unique}${ext}`;
}

/** Content-Disposition that keeps the original name (incl. non-ASCII) for downloads. */
function contentDisposition(type, fileName) {
  if (!fileName) return type;
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Uploads one multer memory-storage file. `asAttachment` makes browsers
 * download it under its original name instead of opening it.
 * Returns the S3 key.
 */
async function uploadFile(file, folder, { asAttachment = false } = {}) {
  assertConfigured();
  const key = buildKey(folder, file);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: contentDisposition(asAttachment ? "attachment" : "inline", file.originalname),
      // Keys are unique per upload, so CloudFront/browsers can cache forever.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return key;
}

/** Public CloudFront URL for a key. */
function publicUrl(key) {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  return `${CLOUDFRONT_URL}/${key}`;
}

/**
 * What the API returns for a stored file value:
 *   - full URL or legacy "/uploads/..." path -> as stored
 *   - S3 key -> CloudFront URL once CLOUDFRONT_URL is set; until then the key
 *     itself (view links start working the moment CloudFront is configured,
 *     with no data migration).
 */
function resolveFileUrl(stored) {
  if (!stored) return stored ?? null;
  if (/^https?:\/\//.test(stored) || stored.startsWith("/uploads/")) return stored;
  return CLOUDFRONT_URL ? `${CLOUDFRONT_URL}/${stored}` : stored;
}

const isCloudFrontConfigured = () => Boolean(CLOUDFRONT_URL);

/** The S3 key behind a stored value (CloudFront URL or bare key); null for legacy /uploads paths. */
function keyFromStored(value) {
  if (!value || value.startsWith("/uploads/")) return null;
  if (CLOUDFRONT_URL && value.startsWith(`${CLOUDFRONT_URL}/`)) return value.slice(CLOUDFRONT_URL.length + 1);
  return /^https?:\/\//.test(value) ? null : value;
}

/**
 * Short-lived link for a private file (e.g. employee ID proofs), straight
 * from S3. `downloadName` forces a download under that name.
 */
async function signedUrl(key, { expiresIn = 300, downloadName } = {}) {
  assertConfigured();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ...(downloadName && { ResponseContentDisposition: contentDisposition("attachment", downloadName) }),
    }),
    { expiresIn },
  );
}

/** Deletes a stored file; ignores legacy local paths and never throws. */
async function deleteStoredFile(storedValue) {
  const key = keyFromStored(storedValue);
  if (!key || !BUCKET) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error(`S3 delete failed for ${key}:`, err.message);
  }
}

module.exports = {
  S3_FOLDERS,
  isS3Configured,
  isCloudFrontConfigured,
  buildKey,
  uploadFile,
  publicUrl,
  resolveFileUrl,
  keyFromStored,
  signedUrl,
  deleteStoredFile,
};

"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");

// File storage: uploads go to S3, files are read through CloudFront signed URLs.
//
// .env
//   AWS_REGION, AWS_S3_BUCKET                   upload to S3 (without these: local src/uploads)
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY    optional on EC2 with an IAM role
//   CLOUDFRONT_URL                              https://dxxxx.cloudfront.net
//   CLOUDFRONT_KEY_PAIR_ID                      CloudFront → Public keys → ID
//   CLOUDFRONT_PRIVATE_KEY_PATH                 optional; default: src/utils/private_key.pem
//
// The database stores only the key ("labour-requests/start_photo-…jpg"), or
// "/uploads/…" for files saved locally. getFileUrl turns that into a link.

const {
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  CLOUDFRONT_KEY_PAIR_ID,
  CLOUDFRONT_PRIVATE_KEY_PATH,
} = process.env;
const CLOUDFRONT_URL = (process.env.CLOUDFRONT_URL || "").replace(/\/+$/, "");

/** One folder (key prefix) per kind of upload. */
const S3_FOLDERS = {
  employeeDocuments: "employee-documents",
  notifications: "notifications",
  labourRequests: "labour-requests",
  expenseRequests: "expense-requests",
  loadingRequests: "loading-requests",
};

const LOCAL_UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const VIEW_LINK_DAYS = 29;
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const s3 = new S3Client({
  region: AWS_REGION,
  ...(AWS_ACCESS_KEY_ID && {
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  }),
});

const isS3Configured = () => Boolean(AWS_REGION && AWS_S3_BUCKET);
const isLocalFile = (value) => typeof value === "string" && value.startsWith("/uploads/");

/** "labour-requests/start_photo-1730000000000-3f9a1c2b.jpg" — unique, never overwritten. */
function generateFileKey(folder, file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return `${folder}/${file.fieldname}-${unique}${extension}`;
}

/* ------------------------------------------------------------------ */
/* Upload / delete                                                     */
/* ------------------------------------------------------------------ */

/**
 * Uploads a multer (memory storage) file to S3 and returns its key.
 * asAttachment: the browser downloads it under its original name instead of opening it.
 */
async function uploadToS3(file, folder, { asAttachment = false } = {}) {
  const key = generateFileKey(folder, file);
  const safeName = (file.originalname || "file").replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");

  await s3.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: `${asAttachment ? "attachment" : "inline"}; filename="${safeName}"`,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return key;
}

/** Deletes a stored file (S3 key or local "/uploads/…" path). Never throws. */
async function deleteFile(stored) {
  if (!stored) return;
  try {
    if (isLocalFile(stored)) {
      await fs.promises.unlink(path.join(LOCAL_UPLOAD_ROOT, stored.replace(/^\/uploads\//, "")));
    } else if (isS3Configured()) {
      await s3.send(new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: stored }));
    }
  } catch (err) {
    console.error(`File delete failed for ${stored}:`, err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Read: CloudFront signed URLs                                        */
/* ------------------------------------------------------------------ */

let privateKey = null;

/** Reads the CloudFront private key once and checks it is a valid PEM key. */
function getPrivateKey() {
  if (privateKey) return privateKey;

  // Default: private_key.pem next to this file (src/utils). An explicit
  // CLOUDFRONT_PRIVATE_KEY_PATH is resolved from the project root.
  const keyPath = CLOUDFRONT_PRIVATE_KEY_PATH
    ? path.resolve(process.cwd(), CLOUDFRONT_PRIVATE_KEY_PATH)
    : path.join(__dirname, "private_key.pem");
  if (!fs.existsSync(keyPath)) {
    throw Object.assign(new Error(`CloudFront private key not found: ${keyPath}`), { statusCode: 500 });
  }
  const pem = fs.readFileSync(keyPath, "utf8");
  try {
    crypto.createPrivateKey(pem);
  } catch {
    throw Object.assign(new Error("CloudFront private key is not a valid PEM key"), { statusCode: 500 });
  }

  privateKey = pem;
  return privateKey;
}

const isCloudFrontReady = () => Boolean(CLOUDFRONT_URL && CLOUDFRONT_KEY_PAIR_ID);

/**
 * The link for a stored file:
 *   - local "/uploads/…" path or full URL -> returned as is
 *   - S3 key -> CloudFront signed URL (null until CloudFront is configured)
 * Default expiry: 29 days, rounded to a whole day so the link stays the same
 * all day (browser cache friendly). expiresInSeconds gives a short-lived link.
 */
function getFileUrl(stored, { expiresInSeconds } = {}) {
  if (!stored) return null;
  if (isLocalFile(stored) || /^https?:\/\//.test(stored)) return stored;
  if (!isCloudFrontReady()) return null;

  let key;
  try {
    key = getPrivateKey();
  } catch (err) {
    // Missing / invalid key: return no link instead of failing the whole response.
    // The reason is logged once at startup (and again here, at most once).
    if (!getFileUrl.warned) console.error(`[cloudfront] ${err.message} — file links will be null`);
    getFileUrl.warned = true;
    return null;
  }

  const expiresAt = expiresInSeconds
    ? Date.now() + expiresInSeconds * 1000
    : Math.ceil((Date.now() + ONE_DAY_MS * VIEW_LINK_DAYS) / ONE_DAY_MS) * ONE_DAY_MS;

  return getSignedUrl({
    url: `${CLOUDFRONT_URL}/${stored}`,
    keyPairId: CLOUDFRONT_KEY_PAIR_ID,
    privateKey: key,
    dateLessThan: new Date(expiresAt),
  });
}

// Check the private key at startup so a bad key shows up in the log right away.
if (isCloudFrontReady()) {
  try {
    getPrivateKey();
  } catch (err) {
    console.error(`[cloudfront] ${err.message}`);
  }
}

module.exports = {
  S3_FOLDERS,
  LOCAL_UPLOAD_ROOT,
  isS3Configured,
  isLocalFile,
  generateFileKey,
  uploadToS3,
  deleteFile,
  getFileUrl,
};

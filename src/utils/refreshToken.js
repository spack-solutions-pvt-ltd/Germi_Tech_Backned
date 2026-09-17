"use strict";
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { RefreshToken } = require("../models");

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // keep in sync with JWT_REFRESH_EXPIRES_IN

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Signs a new refresh token for the given employee and stores its hash in
 * the DB (never the raw token) so it can be looked up, rotated, or revoked
 * later. Returns { token, record }.
 */
async function createRefreshToken(employee) {
  const token = jwt.sign({ id: employee.id }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });

  const record = await RefreshToken.create({
    employeeId: employee.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
  });

  return { token, record };
}

/**
 * Verifies a refresh token's signature + expiry (throws on either failure —
 * let the caller's try/catch turn that into a 401), then looks up its DB
 * record by hash.
 */
async function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  const tokenHash = hashToken(token);
  const record = await RefreshToken.findOne({ where: { tokenHash } });
  return { decoded, record, tokenHash };
}

/** Marks one refresh token used (rotation) or fully revoked. */
async function revokeRefreshToken(record, replacedByTokenHash = null) {
  await record.update({ revokedAt: new Date(), replacedByTokenHash });
}

/** Revokes every currently-active refresh token for an employee — used when reuse of an already-rotated token suggests theft. */
async function revokeAllRefreshTokens(employeeId) {
  await RefreshToken.update({ revokedAt: new Date() }, { where: { employeeId, revokedAt: null } });
}

module.exports = {
  hashToken,
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};










// const createRefreshToken = async (user, type) => {
//   let token = uuidv4();

//   let expiryDate =
//     type === "employee"
//       ? Date.now() + 1000 * 60 * 10
//       : Date.now() + 1000 * 60 * 60 * 24 * 100;

//   let refreshToken = await RefreshToken.create({
//     token: token,
//     userId: user.id,
//     expire: expiryDate,
//     type: type,
//   });
//   return refreshToken;
// };
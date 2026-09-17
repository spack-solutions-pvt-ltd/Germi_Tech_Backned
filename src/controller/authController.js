// const { Employee } = require("../models");
// const bcrypt = require("bcrypt");
// const { createRefreshToken } = require("../utils/refreshToken");
// const jwt = require("jsonwebtoken");

// const login = async (req, res, next) => {
//   const { email, password } = req.body;
//   if (!email || !password) {
//     return res.status(422).json({ message: "Email and password are required" });
//   }
//   try {
//     const employee = await Employee.findOne({ where: { email } });

//     if (!employee) {
//       return res.status(401).json({ success: false, message: "Invalid email" });
//     }

//     if (employee.status !== "Active") {
//       return res.status(403).json({
//         success: false,
//         message: "Your account is Inactive. Contact an admin.",
//       });
//     }
//     // validating password
//     const isValid = await bcrypt.compare(password, employee.password);
//     if (!isValid) {
//       return res.status(401).json({ message: "Invalid password" });
//     }

//     const accessToken = jwt.sign(
//       { id: employee.id, roleId: employee.roleId },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.JWT_EXPIRES_IN },
//     );
//     const refreshToken = await createRefreshToken(employee);
//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       data: { accessToken, refreshToken: refreshToken.token },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// const changePassword = async (req, res,next) => {
//   const { currentPassword, newPassword } = req.body;

//   if (!currentPassword || !newPassword) {
//     return res.status(422).json({
//       success:false,
//       message: "currentPassword, newPasswords are required",
//     });
//   }

//   if (newPassword.length < 8) {
//     return res
//       .status(422)
//       .json({ message: "Password must be at least 8 characters" });
//   }

//   try {
//     const employee = await Employee.findByPk(req.employee.id);
//     if (!employee)
//       return res.status(404).json({ message: "Employee not found" });

//     const isValid = await bcrypt.compare(currentPassword, employee.password);
//     if (!isValid)
//       return res.status(401).json({ message: "Current password is incorrect" });

//     const passwordHash = await bcrypt.hash(newPassword, 10);
//     await employee.update({ password: passwordHash });

//     res.json({ success: false, message: "Password changed successfully" });
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = { login, changePassword };
"use strict";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Employee } = require("../models");
const { sendMail } = require("../utils/mailer");
const { generateOtp } = require("../utils/generateIds");
const { otpEmailTemplate } = require("../templates/otpEmail");
const {
  hashToken,
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} = require("../utils/refreshToken");
const { success, error } = require("../utils/response");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const OTP_EXPIRY_MINUTES = 10;
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET;
const RESET_TOKEN_EXPIRES_IN = "5m";

// Fields that should never leave this file in a response body.
function sanitizeEmployee(employee) {
  const { password, resetPasswordToken, resetPasswordExpires, ...safe } =
    employee.toJSON();
  return safe;
}

/**
 * POST /api/auth/login
 * body: { email, password }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email) return error(res, 422, "Email is required");
    if (!password) return error(res, 422, "Password is required");

    const employee = await Employee.findOne({ where: { email } });

    if (!employee) return error(res, 401, "Invalid email");

    if (employee.status !== "Active") {
      return error(res, 403, "Your account is inactive. Contact an admin.");
    }

    const isValid = await bcrypt.compare(password, employee.password);
    if (!isValid) return error(res, 401, "Invalid password");

    const accessToken = jwt.sign(
      { id: employee.id, roleId: employee.roleId },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      },
    );
    const refreshToken = await createRefreshToken(employee);

    return success(res, 200, "Login successful", {
      data: {
        accessToken,
        refreshToken: refreshToken.token,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh-token
 * body: { refreshToken }
 */
async function refreshTokenHandler(req, res, next) {
  try {
    const { refreshToken: incomingToken } = req.body;
    if (!incomingToken) return error(res, 400, "refreshToken is required");

    let decoded;
    let record;
    try {
      ({ decoded, record } = await verifyRefreshToken(incomingToken));
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return error(res, 401, "Refresh token expired, please log in again");
      }
      return error(res, 401, "Invalid refresh token");
    }

    if (!record) return error(res, 401, "Invalid refresh token");

    if (record.revokedAt) {
      await revokeAllRefreshTokens(record.employeeId);
      return error(
        res,
        401,
        "This refresh token has already been used. All sessions have been logged out for safety.",
      );
    }

    if (record.expiresAt < new Date()) {
      return error(res, 401, "Refresh token expired, please log in again");
    }

    const employee = await Employee.findByPk(decoded.id);
    if (!employee)
      return error(
        res,
        401,
        "Invalid refresh token — employee no longer exists",
      );
    if (employee.status !== "Active") {
      return error(res, 403, "Your account is inactive. Contact an admin.");
    }

    const accessToken = jwt.sign(
      { id: employee.id, roleId: employee.roleId },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      },
    );
    const newRefreshToken = await createRefreshToken(employee);

    await revokeRefreshToken(record, hashToken(newRefreshToken.token));

    return success(res, 200, "Token refreshed successfully", {
      data: { accessToken, refreshToken: newRefreshToken.token },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * body: { email }
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return error(res, 422, "Email is required");

    // Same response whether or not the email exists — don't let this
    // endpoint be used to check which emails are registered.
    const genericMessage =
      "If that email is registered, an OTP has been sent to it.";

    const employee = await Employee.findOne({ where: { email } });
    if (!employee) return success(res, 200, genericMessage);

    const otp = generateOtp();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await employee.update({
      resetPasswordToken: hashedOtp,
      resetPasswordExpires: expires,
    });

    await sendMail({
      to: employee.email,
      subject: "Your Germitech password reset code",
      html: otpEmailTemplate({
        name: employee.name,
        otp,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      }),
    });

    return success(res, 200, genericMessage);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/verify-otp
 * body: { email, otp }
 * Confirms the OTP, consumes it immediately (single-use), and issues a
 * short-lived resetToken that authorizes the actual password change.
 */
async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email) return error(res, 422, "email is required");
    if (!otp) return error(res, 422, "otp is required");

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const employee = await Employee.findOne({
      where: { email, resetPasswordToken: hashedOtp },
    });

    if (
      !employee ||
      !employee.resetPasswordExpires ||
      employee.resetPasswordExpires < new Date()
    ) {
      return error(res, 400, "OTP is invalid or has expired");
    }

    await employee.update({
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    const resetToken = jwt.sign(
      { id: employee.id, purpose: "password_reset" },
      RESET_TOKEN_SECRET,
      {
        expiresIn: RESET_TOKEN_EXPIRES_IN,
      },
    );

    return success(res, 200, "OTP verified", { data: { resetToken } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reset-password
 * body: { resetToken, newPassword, confirmPassword }
 * resetToken comes from verify-otp — email/OTP are not needed again here.
 */
async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken) return error(res, 422, "resetToken is required");
    if (!newPassword) return error(res, 422, "newPassword is required");
    if (!confirmPassword) return error(res, 422, "confirmPassword is required");
    if (newPassword !== confirmPassword)
      return error(res, 422, "Passwords do not match");
    if (newPassword.length < 8)
      return error(res, 422, "Password must be at least 8 characters");

    let decoded;
    try {
      decoded = jwt.verify(resetToken, RESET_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return error(
          res,
          401,
          "Reset session expired, please request a new OTP",
        );
      }
      return error(res, 401, "Invalid reset token");
    }

    if (decoded.purpose !== "password_reset")
      return error(res, 401, "Invalid reset token");

    const employee = await Employee.findByPk(decoded.id);
    if (!employee)
      return error(res, 401, "Invalid reset token — employee no longer exists");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await employee.update({ password: passwordHash });

    return success(
      res,
      200,
      "Password reset successfully. You can now log in.",
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/change-password
 * Requires auth middleware to have set req.employee = { id: <employeeId>, ... }
 * body: { currentPassword, newPassword }
 */
async function changePassword(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) return error(res, 422, "currentPassword is required");
    if (!newPassword) return error(res, 422, "newPassword is required");
    if (newPassword.length < 8)
      return error(res, 422, "Password must be at least 8 characters");
    if (newPassword === currentPassword) {
      return error(
        res,
        422,
        "New password must be different from the current password",
      );
    }

    const employee = await Employee.findByPk(req.employee.id);
    if (!employee) return error(res, 404, "Employee not found");

    const isValid = await bcrypt.compare(currentPassword, employee.password);
    if (!isValid) return error(res, 401, "Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await employee.update({ password: passwordHash });

    return success(res, 200, "Password changed successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  refreshToken: refreshTokenHandler,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
};

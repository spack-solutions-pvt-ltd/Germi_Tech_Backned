"use strict";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Employee, Role, Permission } = require("../models");
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
const { v4: uuidv4 } = require("uuid");
const {
  getEffectivePermissionCodes,
} = require("../middleWare/auth.middleware");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const OTP_EXPIRY_MINUTES = 5;
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET;
const RESET_TOKEN_EXPIRES_IN = "5m";

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
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
};
/**
 * POST /api/auth/refresh-token
 */
const refreshTokenHandler = async (req, res, next) => {
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
};
/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return error(res, 422, "Email is required");
    }

    // Find employee
    const employee = await Employee.findOne({
      where: {
        email,
      },
    });

    if (!employee) {
      return error(res, 404, "Employee not found");
    }

    // Check employee status
    if (employee.status && employee.status.toLowerCase() !== "active") {
      return error(
        res,
        403,
        "Your account is inactive. Please contact the admin.",
      );
    }
    const otp = generateOtp();

    // Hash OTP before storing
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    // Set OTP expiry
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 8. Save OTP details
    await employee.update({
      resetPasswordToken: hashedOtp,
      resetPasswordExpires: expiresAt,
    });

    // 9. Send OTP email
    try {
      await sendMail({
        to: employee.email,
        subject: "Your Germitech Password Reset Code",
        html: otpEmailTemplate({
          name: employee.name,
          otp,
          expiresInMinutes: OTP_EXPIRY_MINUTES,
        }),
      });
    } catch (mailError) {
      await employee.update({
        resetPasswordToken: null,
        resetPasswordExpires: null,
      });

      throw mailError;
    }
    return success(
      res,
      200,
      "Password reset OTP has been sent to your email address",
    );
  } catch (err) {
    next(err);
  }
};
// Verify OTP
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || typeof email !== "string")
      return error(res, 422, "Email is required");

    if (!otp) return error(res, 422, "OTP is required");

    // Find employee
    const employee = await Employee.findOne({
      where: {
        email,
      },
    });

    if (!employee) {
      return error(res, 404, "Employee not found");
    }

    // Check employee status
    if (employee.status && employee.status.toLowerCase() !== "active") {
      return error(
        res,
        403,
        "Your account is inactive. Please contact the admin.",
      );
    }

    // Check whether an OTP was generated
    if (!employee.resetPasswordToken || !employee.resetPasswordExpires) {
      return error(
        res,
        400,
        "No password reset OTP is available. Please request a new OTP.",
      );
    }

    // Check OTP expiry
    if (new Date() > new Date(employee.resetPasswordExpires)) {
      // Clear expired OTP
      await employee.update({
        resetPasswordToken: null,
        resetPasswordExpires: null,
      });

      return error(res, 400, "The OTP has expired");
    }

    // Hash the entered OTP
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Compare OTP
    if (hashedOtp !== employee.resetPasswordToken) {
      return error(res, 400, "Invalid OTP");
    }

    // OTP is valid — clear it so it cannot be reused
    await employee.update({
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    let token = uuidv4();

    // Generate password reset token
    const resetToken = jwt.sign(
      {
        id: employee.id,
        purpose: "password_reset",
      },
      RESET_TOKEN_SECRET,
      {
        expiresIn: RESET_TOKEN_EXPIRES_IN,
      },
    );

    // Return reset token
    return success(res, 200, "OTP verified successfully.", {
      data: {
        resetToken,
      },
    });
  } catch (err) {
    next(err);
  }
};
/**
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
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
};
/**
 * POST /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
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
};
const getUserDetails = async (req, res, next) => {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    const employee = await Employee.findByPk(req.employee.id, {
      include: {
        model: Role,
        as: "role",
        include: { model: Permission, as: "permissions" },
      },
    });
    if (!employee) return error(res, 404, "Employee not found");

    const rolePermissions = employee.role ? employee.role.permissions : [];
    const effectiveCodes = await getEffectivePermissionCodes(
      employee.id,
      rolePermissions,
    );

    const {
      password,
      resetPasswordToken,
      resetPasswordExpires,
      role,
      ...employeeFields
    } = employee.toJSON();

    return success(res, 200, "Employee details fetched successfully", {
      data: {
        ...employeeFields,
        role: role
          ? {
              id: role.id,
              name: role.name,
              description: role.description,
              status: role.status,
            }
          : null,
        permissions: Array.from(effectiveCodes),
      },
    });
  } catch (err) {
    next(err);
  }
};
module.exports = {
  login,
  refreshToken: refreshTokenHandler,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  getUserDetails,
  resendOtp:forgotPassword
};

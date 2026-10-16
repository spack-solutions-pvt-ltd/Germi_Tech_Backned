"use strict";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Employee, Role, Permission, RefreshToken } = require("../models");
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
const { getMyNotificationCounts } = require("../utils/notificationCounts");
const { v4: uuidv4 } = require("uuid");
const {
  getEffectivePermissionCodes,
} = require("../middleWare/auth.middleware");
const { authMessages } = require("../constants/message/authMessages");

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

    if (!email) return error(res, 422, authMessages.emailIsRequired);
    if (!password) return error(res, 422, authMessages.passwordIsRequired);

    const employee = await Employee.findOne({ where: { email } });

    if (!employee) return error(res, 401, authMessages.invalidEmail);

    if (employee.status !== "Active") {
      return error(res, 403, authMessages.yourAccountIsInactiveContactAn);
    }

    const isValid = await bcrypt.compare(password, employee.password);
    if (!isValid) return error(res, 401, authMessages.invalidPassword);

    const accessToken = jwt.sign(
      { id: employee.id, roleId: employee.roleId },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      },
    );
    const refreshToken = await createRefreshToken(employee);

    return success(res, 200, authMessages.loginSuccess, {
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
    if (!incomingToken) return error(res, 400, authMessages.refreshTokenIsRequired);

    let decoded;
    let record;
    try {
      ({ decoded, record } = await verifyRefreshToken(incomingToken));
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return error(res, 401, authMessages.refreshTokenExpiredPleaseLogIn);
      }
      return error(res, 401, authMessages.invalidRefreshToken);
    }

    if (!record) return error(res, 401, authMessages.invalidRefreshToken);

    if (record.revokedAt) {
      await revokeAllRefreshTokens(record.employeeId);
      return error(
        res,
        401,
        authMessages.thisRefreshTokenHasAlreadyBeen,
      );
    }

    if (record.expiresAt < new Date()) {
      return error(res, 401, authMessages.refreshTokenExpiredPleaseLogIn);
    }

    const employee = await Employee.findByPk(decoded.id);
    if (!employee)
      return error(
        res,
        401,
        authMessages.invalidRefreshTokenEmployeeNoLonger,
      );
    if (employee.status !== "Active") {
      return error(res, 403, authMessages.yourAccountIsInactiveContactAn);
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

    return success(res, 200, authMessages.tokenRefreshedSuccessfully, {
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
      return error(res, 422, authMessages.emailIsRequired);
    }

    // Find employee
    const employee = await Employee.findOne({
      where: {
        email,
      },
    });

    if (!employee) {
      return error(res, 404, authMessages.empNotFound);
    }

    // Check employee status
    if (employee.status && employee.status.toLowerCase() !== "active") {
      return error(
        res,
        403,
        authMessages.yourAccountIsInactivePleaseContact,
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
      authMessages.passwordResetOtpHasBeenSent,
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
      return error(res, 422, authMessages.emailIsRequired);

    if (!otp) return error(res, 422, authMessages.oTPIsRequired);

    // Find employee
    const employee = await Employee.findOne({
      where: {
        email,
      },
    });

    if (!employee) {
      return error(res, 404, authMessages.empNotFound);
    }

    // Check employee status
    if (employee.status && employee.status.toLowerCase() !== "active") {
      return error(
        res,
        403,
        authMessages.yourAccountIsInactivePleaseContact,
      );
    }

    // Check whether an OTP was generated
    if (!employee.resetPasswordToken || !employee.resetPasswordExpires) {
      return error(
        res,
        400,
        authMessages.noPasswordResetOtpIsAvailable,
      );
    }

    // Check OTP expiry
    if (new Date() > new Date(employee.resetPasswordExpires)) {
      // Clear expired OTP
      await employee.update({
        resetPasswordToken: null,
        resetPasswordExpires: null,
      });

      return error(res, 400, authMessages.theOtpHasExpired);
    }

    // Hash the entered OTP
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Compare OTP
    if (hashedOtp !== employee.resetPasswordToken) {
      return error(res, 400, authMessages.invalidOtp);
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
    return success(res, 200, authMessages.oTPVerifiedSuccessfully, {
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

    if (!resetToken) return error(res, 422, authMessages.resetTokenIsRequired);
    if (!newPassword) return error(res, 422, authMessages.newPasswordIsRequired);
    if (!confirmPassword) return error(res, 422, authMessages.confirmPasswordIsRequired);
    if (newPassword !== confirmPassword)
      return error(res, 422, authMessages.passwordsDoNotMatch);
    if (newPassword.length < 8)
      return error(res, 422, authMessages.passwordValidation);

    let decoded;
    try {
      decoded = jwt.verify(resetToken, RESET_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return error(
          res,
          401,
          authMessages.resetSessionExpiredPleaseRequestA,
        );
      }
      return error(res, 401, authMessages.invalidResetToken);
    }

    if (decoded.purpose !== "password_reset")
      return error(res, 401, authMessages.invalidResetToken);

    const employee = await Employee.findByPk(decoded.id);
    if (!employee)
      return error(res, 401, authMessages.invalidResetTokenEmployeeNoLonger);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await employee.update({ password: passwordHash });

    return success(
      res,
      200,
      authMessages.passwordResetSuccessfullyYouCanNow,
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
    if (!req.employee) return error(res, 401, authMessages.authenticationRequired);

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) return error(res, 422, authMessages.currentPasswordIsRequired);
    if (!newPassword) return error(res, 422, authMessages.newPasswordIsRequired);
    if (newPassword.length < 8)
      return error(res, 422, authMessages.passwordValidation);
    if (newPassword === currentPassword) {
      return error(
        res,
        422,
        authMessages.newPasswordMustBeDifferentFrom,
      );
    }

    const employee = await Employee.findByPk(req.employee.id);
    if (!employee) return error(res, 404, authMessages.empNotFound);

    const isValid = await bcrypt.compare(currentPassword, employee.password);
    if (!isValid) return error(res, 401, authMessages.incrPwd);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await employee.update({ password: passwordHash });

    return success(res, 200, authMessages.changePwdSuccess);
  } catch (err) {
    next(err);
  }
};
const getUserDetails = async (req, res, next) => {
  try {
    if (!req.employee) return error(res, 401, authMessages.authenticationRequired);

    const employee = await Employee.findByPk(req.employee.id, {
      include: {
        model: Role,
        as: "role",
        include: { model: Permission, as: "permissions" },
      },
    });
    if (!employee) return error(res, 404, authMessages.empNotFound);

    const rolePermissions = employee.role ? employee.role.permissions : [];
    const [effectiveCodes, notificationCounts] = await Promise.all([
      getEffectivePermissionCodes(employee.id, rolePermissions),
      getMyNotificationCounts(employee), // bell badge
    ]);

    const {
      password,
      resetPasswordToken,
      resetPasswordExpires,
      role,
      ...employeeFields
    } = employee.toJSON();

    return success(res, 200, authMessages.employeeDetailsFetchedSuccessfully, {
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
        unreadNotificationCount: notificationCounts.unread,
      },
    });
  } catch (err) {
    next(err);
  }
};
/**
 * POST /api/auth/logout   body: { refreshToken }
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: incomingToken } = req.body || {};
    if (!incomingToken) return error(res, 400, authMessages.refreshTokenIsRequired);

    const deleted = await RefreshToken.destroy({ where: { tokenHash: hashToken(incomingToken) } });
    if (!deleted) return error(res, 404, authMessages.refreshTokenNotFoundOrAlready);

    return success(res, 200, authMessages.loggedOutSuccessfully);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  logout,
  refreshToken: refreshTokenHandler,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  getUserDetails,
  resendOtp:forgotPassword
};
